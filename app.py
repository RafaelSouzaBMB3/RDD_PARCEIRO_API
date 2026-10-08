import os
import re
import io
import json
import sqlite3
import tempfile
import subprocess
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


@app.get("/")
def root():
    return {"ok": True, "service": "RDD Parceiro BMB3 API"}


@app.get("/health")
def health():
    return {"ok": True, "template": TEMPLATE.exists(), "db": str(DB_PATH)}


@app.get("/api/next-rdd")
def next_rdd():
    """Devolve o próximo número SEM consumir, para conferência."""
    con = db()
    row = con.execute(
        "SELECT next_number FROM counters WHERE id=1"
    ).fetchone()
    con.close()
    return {"next": f"RDD-{int(row[0]):03d}", "db": str(DB_PATH)}


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
