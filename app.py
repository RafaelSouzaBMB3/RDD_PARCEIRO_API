import os
import re
import io
import json
import base64
import sqlite3
import tempfile
import subprocess
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from openpyxl import load_workbook
from openpyxl.styles import Border, Side, PatternFill, Font, Alignment
from PIL import Image
import fitz  # PyMuPDF

try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except Exception:
    pass

BASE_DIR = Path(__file__).resolve().parent
TEMPLATE = BASE_DIR / "template" / "RDD.PARCEIRO.xlsx"
DATA_DIR = Path(os.getenv("DATA_DIR", str(BASE_DIR / "data")))
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "rdd.db"

# Diagnóstico: deixa visível nos logs do Render onde o contador está sendo
# gravado. Se o caminho não for o disco persistente (/data), o número
# sequencial zera a cada restart/redeploy.
print(f"[RDD] DATA_DIR={DATA_DIR}  DB={DB_PATH}  exists={DB_PATH.exists()}")

# ------------------------------------------------------------------
# CONTADOR SEQUENCIAL
# O Render free tier NAO oferece discos persistentes, entao o
# arquivo /data/rdd.db e recriado a cada restart e o numero
# sempre voltava para RDD_SEED. Solucao: o contador passa a
# morar no PROPRIO REPOSITORIO GITHUB (arquivo JSON), que
# sobrevive a restart, redeploy e troca de container.
# Para ativar, configure em Render -> Environment Variables:
#   GITHUB_TOKEN  = token de acesso (escopo "repo" / Contents)
#   GITHUB_REPO   = opcional, padrao abaixo
#   GITHUB_BRANCH = opcional, padrao "main"
# Sem GITHUB_TOKEN, usa o SQLite local (NAO persiste em restart).
# ------------------------------------------------------------------
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "").strip()
GITHUB_REPO = os.getenv("GITHUB_REPO", "RafaelSouzaBMB3/RDD_PARCEIRO_API").strip()
GITHUB_BRANCH = os.getenv("GITHUB_BRANCH", "main").strip()
GITHUB_COUNTER_PATH = os.getenv("GITHUB_COUNTER_PATH", "counter/rdd-counter.json").strip()
COUNTER_START = 210

# Diagnostico seguro: mostra só o tamanho e o prefixo
# do token (NUNCA o valor inteiro) para conferir se
# a variavel chegou inteira no Render.
if GITHUB_TOKEN:
    print(
        f"[RDD] GITHUB_TOKEN carregado: {len(GITHUB_TOKEN)} chars, "
        f"prefixo '{GITHUB_TOKEN[:4]}...'"
    )


def _gh_headers():
    return {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "rdd-parceiro-api",
    }


def _seed_number():
    seed = os.getenv("RDD_SEED", "").strip()
    return int(seed) if seed.isdigit() else COUNTER_START


def gh_read_counter():
    """Le o contador no repo. Devolve {"next": int, "sha": str} ou None."""
    url = (
        "https://api.github.com/repos/"
        f"{GITHUB_REPO}/contents/{GITHUB_COUNTER_PATH}?ref={GITHUB_BRANCH}"
    )
    req = urllib.request.Request(url, headers=_gh_headers())
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        raw = base64.b64decode(data["content"]).decode("utf-8")
        return {"next": int(json.loads(raw)["next"]), "sha": data["sha"]}
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return None  # arquivo ainda nao existe
        raise


def gh_write_counter(next_number, sha=None):
    """Grava o contador no repo. Devolve True ou False (conflito 409)."""
    url = (
        "https://api.github.com/repos/"
        f"{GITHUB_REPO}/contents/{GITHUB_COUNTER_PATH}"
    )
    body = {
        "message": f"Contador RDD: proximo = {next_number}",
        "content": base64.b64encode(
            json.dumps({"next": next_number}).encode("utf-8")
        ).decode("ascii"),
        "branch": GITHUB_BRANCH,
    }
    if sha:
        body["sha"] = sha
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers=_gh_headers(),
        method="PUT",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            resp.read()
        return True
    except urllib.error.HTTPError as exc:
        if exc.code == 409:
            return False  # sha desatualizado -> ler de novo e tentar
        raise

CATEGORY_COLUMNS = {
    "Transporte": "F",
    "Combustível": "G",
    "Refeições": "H",
    "Hospedagem": "I",
    "Materiais": "J",
    "Diversos": "K",
}

app = FastAPI(title="RDD Parceiro BMB3 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restringiremos ao GitHub Pages depois do primeiro teste
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


def db():
    con = sqlite3.connect(DB_PATH, timeout=30)
    con.execute("PRAGMA journal_mode=WAL")
    return con


def init_db():
    con = db()
    con.execute("""
        CREATE TABLE IF NOT EXISTS counters (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            next_number INTEGER NOT NULL
        )
    """)
    con.execute(
        "INSERT OR IGNORE INTO counters (id, next_number) VALUES (1, 210)"
    )
    # Segurança contra perda do disco: se o container recomeçar com o
    # banco zerado, RDD_SEED permite continuar a sequência de onde
    # parou (configure em Render -> Environment Variables).
    seed = os.getenv("RDD_SEED", "").strip()
    if seed.isdigit():
        s = int(seed)
        row = con.execute(
            "SELECT next_number FROM counters WHERE id=1"
        ).fetchone()
        if row and s > int(row[0]):
            con.execute(
                "UPDATE counters SET next_number=? WHERE id=1", (s,)
            )
            print(f"[RDD] contador ajustado por RDD_SEED para {s}")
    con.commit()
    con.close()


@app.on_event("startup")
def startup():
    init_db()
    print(
        "[RDD] contador sequencial: "
        + ("GITHUB (repo " + GITHUB_REPO + ")" if GITHUB_TOKEN
           else "SQLite LOCAL - NAO persiste em restart! Configure GITHUB_TOKEN")
    )


@app.get("/")
def root():
    return {"ok": True, "service": "RDD Parceiro BMB3 API"}


@app.get("/health")
def health():
    return {"ok": True, "template": TEMPLATE.exists(), "db": str(DB_PATH)}


@app.get("/api/token-info")
def token_info():
    """Diagnostico seguro: mostra apenas tamanho e prefixo
    do GITHUB_TOKEN (NUNCA o valor) para conferir se a
    variavel de ambiente chegou inteira no Render."""
    if not GITHUB_TOKEN:
        return {"set": False, "hint": "GITHUB_TOKEN nao definida"}
    return {
        "set": True,
        "chars": len(GITHUB_TOKEN),
        "prefix": GITHUB_TOKEN[:4],
        "suffix": GITHUB_TOKEN[-4:],
        "expect": "chars=40, prefix='ghp_'",
    }


@app.get("/api/next-rdd")
def next_rdd():
    """Devolve o proximo numero SEM consumir, para conferencia."""
    if GITHUB_TOKEN:
        try:
            state = gh_read_counter()
            n = int(state["next"]) if state else _seed_number()
            return {
                "next": f"RDD-{n:03d}",
                "source": "github",
                "path": f"{GITHUB_REPO}/{GITHUB_COUNTER_PATH}",
            }
        except Exception as exc:
            raise HTTPException(503, f"Erro ao ler o contador no GitHub: {exc}")
    con = db()
    row = con.execute(
        "SELECT next_number FROM counters WHERE id=1"
    ).fetchone()
    con.close()
    return {"next": f"RDD-{int(row[0]):03d}", "source": "sqlite-local", "db": str(DB_PATH)}


def parse_date(value):
    if not value:
        return None
    s = str(value).strip()
    # Aceita YYYY-MM-DD e DD/MM/YYYY
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            from datetime import datetime
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None


def money(value):
    if value is None or value == "":
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip().replace("R$", "").replace(" ", "")
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    return float(s)


def safe_filename(value):
    """Gera um nome seguro para o arquivo PDF sem remover acentos."""
    value = str(value or "").strip()
    value = re.sub(r'[\\/:*?"<>|]+', " ", value)
    value = re.sub(r'\s+', " ", value).strip(" .")
    return value or "Sem Nome"


def get_next_rdd_number():
    if GITHUB_TOKEN:
        # Contador no repositorio GitHub: sobrevive a restart,
        # redeploy e troca de container. Lock otimista pelo sha
        # do arquivo; em conflito (409) le de novo e tenta outra vez.
        for _ in range(6):
            state = gh_read_counter()
            if state is None:
                n = _seed_number()
                if gh_write_counter(n + 1, sha=None):
                    print(f"[RDD] contador criado no repo, primeiro numero RDD-{n:03d}")
                    return n
                continue
            n = int(state["next"])
            if gh_write_counter(n + 1, sha=state["sha"]):
                return n
        raise RuntimeError(
            "Nao foi possivel atualizar o contador no GitHub. Tente novamente."
        )

    # Modo local (sem GITHUB_TOKEN): NAO persiste em restart.
    con = db()
    try:
        con.execute("BEGIN IMMEDIATE")
        row = con.execute(
            "SELECT next_number FROM counters WHERE id=1"
        ).fetchone()
        n = int(row[0])
        con.execute(
            "UPDATE counters SET next_number=? WHERE id=1",
            (n + 1,)
        )
        con.commit()
        return n
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def fill_workbook(payload, rdd_number, output_xlsx):
    wb = load_workbook(TEMPLATE)
    if "RDD" not in wb.sheetnames:
        raise RuntimeError("Aba RDD não encontrada no modelo.")
    ws = wb["RDD"]

    # Cabeçalho
    ws["F3"] = f"RDD-{rdd_number:03d}"

    today = date.today()
    first = today.replace(day=1)
    if today.month == 12:
        next_month = today.replace(year=today.year + 1, month=1, day=1)
    else:
        next_month = today.replace(month=today.month + 1, day=1)
    last = next_month.fromordinal(next_month.toordinal() - 1)

    ws["I3"] = first
    ws["K3"] = last
    ws["I3"].number_format = "dd/mm/yyyy"
    ws["K3"].number_format = "dd/mm/yyyy"

    ws["C5"] = payload.get("nome", "")
    ws["K5"] = payload.get("cpf", "")
    ws["K6"] = payload.get("obra", "")

    # O campo VNC (J4/K4) vem pré-preenchido no arquivo modelo
    # do repositório. A pessoa responsável apagou o valor na
    # planilha dela, mas o servidor continuava imprimindo porque
    # usa o modelo do repo. Limpamos aqui para que o PDF saia
    # em branco. Se quiser o VNC de volta, remova estas duas linhas.
    ws["J4"] = None
    ws["K4"] = None

    # Limpa as linhas de despesas antes de preencher.
    for r in range(9, 44):
        ws[f"B{r}"] = None
        ws[f"C{r}"] = None
        ws[f"D{r}"] = None
        ws[f"E{r}"] = None
        for col in "FGHIJK":
            ws[f"{col}{r}"] = None
        # preserva/recria a fórmula de total
        ws[f"L{r}"] = f"=SUM(F{r}:K{r})"

    receipts = payload.get("receipts", [])
    if not isinstance(receipts, list):
        raise ValueError("receipts deve ser uma lista.")

    if len(receipts) > 35:
        raise ValueError("O modelo possui 35 linhas de despesas (9 a 43).")

    for idx, item in enumerate(receipts, start=9):
        d = parse_date(item.get("date"))
        if d:
            ws[f"B{idx}"] = d
            ws[f"B{idx}"].number_format = "dd/mm/yyyy"

        ws[f"C{idx}"] = item.get("account", "")
        ws[f"D{idx}"] = item.get("description", "")
        ws[f"E{idx}"] = item.get("document", "")

        category = str(item.get("category", "")).strip()
        if category not in CATEGORY_COLUMNS:
            raise ValueError(f"Categoria inválida: {category}")

        ws[f"{CATEGORY_COLUMNS[category]}{idx}"] = money(item.get("value"))

    # Garante área de impressão do modelo
    ws.print_area = "A1:L49"

    # --------------------------------------------------------
    # AREA FINAL: apenas o TOTAL (linha 47)
    # O modelo do repositorio traz varias linhas
    # abaixo da tabela (SUBTOTAL, Aprovado, Anotacoes,
    # PAGAMENTOS e o total repetido). Mantemos somente
    # o TOTAL da linha 47, em azul, e limpamos todo o
    # restante para que nada apareca abaixo dele.
    # --------------------------------------------------------
    try:
        # 1) limpa as linhas 48 e 49 (total duplicado)
        for linha_inferior in (48, 49):
            celula_inferior = ws[f"L{linha_inferior}"]
            celula_inferior.value = None
            celula_inferior.border = Border()

        # 2) limpa o texto da coluna K dessas linhas
        for linha_inferior in (48, 49):
            celula_rotulo = ws[f"K{linha_inferior}"]
            celula_rotulo.value = None
            celula_rotulo.border = Border()

        # 3) garante que a linha 47 tem o rotulo e o total
        ws["K47"] = "TOTAL"
        ws["K47"].font = Font(bold=True)
        ws["K47"].alignment = Alignment(horizontal="right")

        # mantem a formula do total na L47
        if not ws["L47"].value:
            ws["L47"] = f"=L45"

        # 4) pinta o total de azul
        celula_total = ws["L47"]
        celula_total.font = Font(
            bold=True,
            color="FF0000FF"
        )
        celula_total.alignment = Alignment(
            horizontal="right"
        )

    except Exception as erro_total:
        print(f"[RDD] aviso ao ajustar area final: {erro_total}")


    # --------------------------------------------------------
    # GRADE DA TABELA (barras diretas nas células)
    # O modelo usa "Tabelas do Excel" (table styles) para a
    # grade, mas o LibreOffice NÃO renderiza table styles na
    # conversão para PDF. Sem bordas diretas, a tabela sai
    # sem colunas visíveis e o resultado parece desalinhado.
    # --------------------------------------------------------
    thin = Side(style="thin", color="8E9AAF")
    grade = Border(left=thin, right=thin, top=thin, bottom=thin)

    # Cabeçalho (linha 8) + lançamentos (9 a 43) + totais (44)
    for row in ws.iter_rows(min_row=8, max_row=44, min_col=2, max_col=12):
        for cell in row:
            cell.border = grade

    # Cabeçalho com fundo verde e texto branco em destaque
    head_fill = PatternFill("solid", fgColor="0B6B45")
    for cell in ws[8]:
        if 2 <= cell.column <= 12:
            cell.fill = head_fill
            cell.font = Font(bold=True, color="FFFFFF")
            cell.alignment = Alignment(horizontal="center", vertical="center")

    # Alinhamento das colunas: data/documento centrais,
    # descrição à esquerda, valores sempre à direita.
    for r in range(9, 44):
        ws.cell(row=r, column=2).alignment = Alignment(horizontal="center")
        ws.cell(row=r, column=5).alignment = Alignment(horizontal="center")
        for col in range(6, 13):
            ws.cell(row=r, column=col).alignment = Alignment(horizontal="right")

    # Linha de totais em destaque
    for cell in ws[44]:
        if 2 <= cell.column <= 12:
            cell.font = Font(bold=True)

    # IMPORTANTE: hide every other sheet from the PDF output. The shared
    # template contains old sheets (RDD-112, RDD-113, etc.) with previous
    # data; if they stay visible, LibreOffice appends them to the final PDF.
    for sheet in wb.worksheets:
        if sheet.title != "RDD":
            sheet.sheet_state = "hidden"
    wb.active = wb.sheetnames.index("RDD")

    wb.save(output_xlsx)


def append_images_to_pdf(pdf_path, image_files):
    doc = fitz.open(pdf_path)
    for img_path in image_files:
        try:
            with Image.open(img_path) as im:
                im = im.convert("RGB")
                # Limita resolução exagerada sem perder legibilidade.
                max_side = 2200
                if max(im.size) > max_side:
                    ratio = max_side / max(im.size)
                    im = im.resize((int(im.width * ratio), int(im.height * ratio)))
                buf = io.BytesIO()
                im.save(buf, format="JPEG", quality=82, optimize=True)
                rect = fitz.Rect(0, 0, 595, 842)  # A4 aproximado
                page = doc.new_page(width=rect.width, height=rect.height)
                # preserva proporção
                margin = 18
                box = fitz.Rect(margin, margin, rect.width-margin, rect.height-margin)
                page.insert_image(box, stream=buf.getvalue(), keep_proportion=True, overlay=True)
        except Exception as exc:
            raise ValueError(f"Não foi possível anexar a imagem {img_path.name}: {exc}")
    doc.save(pdf_path.with_name(pdf_path.stem + "_final.pdf"), garbage=4, deflate=True)
    final = pdf_path.with_name(pdf_path.stem + "_final.pdf")
    doc.close()
    return final


@app.post("/api/generate")
async def generate(
    payload: str = Form(...),
    receipts: list[UploadFile] = File(default=[]),
):
    if not TEMPLATE.exists():
        raise HTTPException(500, "Modelo RDD.PARCEIRO.xlsx não encontrado no servidor.")

    try:
        data = json.loads(payload)
    except Exception:
        raise HTTPException(400, "Payload JSON inválido.")

    required = ["nome", "cpf", "obra"]
    missing = [x for x in required if not str(data.get(x, "")).strip()]
    if missing:
        raise HTTPException(400, "Campos obrigatórios ausentes: " + ", ".join(missing))

    receipt_data = data.get("receipts", [])
    if not receipt_data:
        raise HTTPException(400, "Nenhum cupom informado.")

    for i, item in enumerate(receipt_data, 1):
        if not str(item.get("document", "")).strip():
            raise HTTPException(400, f"Cupom {i}: número do documento é obrigatório.")
        if not str(item.get("category", "")).strip():
            raise HTTPException(400, f"Cupom {i}: categoria é obrigatória.")

    rdd_number = get_next_rdd_number()

    workdir = Path(tempfile.mkdtemp(prefix="rdd_"))
    xlsx = workdir / f"RDD-{rdd_number:03d}.xlsx"
    pdf = workdir / f"RDD-{rdd_number:03d}.pdf"

    try:
        fill_workbook(data, rdd_number, xlsx)

        # LibreOffice é instalado no container e faz a conversão real do Excel.
        cmd = [
            "libreoffice", "--headless", "--convert-to", "pdf",
            "--outdir", str(workdir), str(xlsx)
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
        if proc.returncode != 0 or not pdf.exists():
            raise RuntimeError(
                "Falha na conversão Excel -> PDF. "
                + (proc.stderr or proc.stdout or "")
            )

        # Salva os uploads e acrescenta cada cupom como uma página.
        image_paths = []
        for i, upload in enumerate(receipts):
            suffix = Path(upload.filename or "").suffix.lower() or ".jpg"
            p = workdir / f"cupom_{i+1}{suffix}"
            content = await upload.read()
            if not content:
                continue
            p.write_bytes(content)
            image_paths.append(p)

        final_pdf = append_images_to_pdf(pdf, image_paths) if image_paths else pdf

        return FileResponse(
            final_pdf,
            media_type="application/pdf",
            filename=f"{safe_filename(data.get('nome'))} - RDD-{rdd_number:03d}.pdf",
            background=None,
        )

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, f"Erro ao gerar RDD: {exc}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
