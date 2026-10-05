import os
import io
import json
import sqlite3
import tempfile
import subprocess
from datetime import date, datetime
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from openpyxl import load_workbook
from PIL import Image
import fitz  # PyMuPDF


# ============================================================
# CONFIGURAÇÕES
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

TEMPLATE = BASE_DIR / "template" / "RDD.PARCEIRO.xlsx"

DATA_DIR = Path(
    os.getenv(
        "DATA_DIR",
        str(BASE_DIR / "data")
    )
)

DATA_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = DATA_DIR / "rdd.db"


# ============================================================
# CATEGORIAS DO RDD
# ============================================================

CATEGORY_COLUMNS = {
    "Transporte": "F",
    "Combustível": "G",
    "Refeições": "H",
    "Hospedagem": "I",
    "Materiais": "J",
    "Diversos": "K",
}


# Mapa normalizado para aceitar:
# Materiais
# materiais
# MATERIAIS
# MaTeRiAiS
#
# Todos serão tratados como "Materiais"
CATEGORY_COLUMNS_NORMALIZED = {
    chave.casefold(): coluna
    for chave, coluna in CATEGORY_COLUMNS.items()
}


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="RDD Parceiro BMB3 API",
    version="1.0.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# BANCO DE DADOS
# ============================================================

def db():
    con = sqlite3.connect(
        DB_PATH,
        timeout=30
    )

    con.execute("PRAGMA journal_mode=WAL")

    return con


def init_db():
    con = db()

    con.execute(
        """
        CREATE TABLE IF NOT EXISTS counters (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            next_number INTEGER NOT NULL
        )
        """
    )

    con.execute(
        """
        INSERT OR IGNORE INTO counters
        (id, next_number)
        VALUES
        (1, 210)
        """
    )

    con.commit()
    con.close()


@app.on_event("startup")
def startup():
    init_db()


# ============================================================
# ROTAS BÁSICAS
# ============================================================

@app.get("/")
def root():
    return {
        "ok": True,
        "service": "RDD Parceiro BMB3 API"
    }


@app.get("/health")
def health():
    return {
        "ok": True,
        "template": TEMPLATE.exists()
    }


# ============================================================
# UTILITÁRIOS
# ============================================================

def parse_date(value):
    """
    Aceita:
    YYYY-MM-DD
    DD/MM/YYYY
    """

    if not value:
        return None

    s = str(value).strip()

    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):

        try:
            return datetime.strptime(
                s,
                fmt
            ).date()

        except ValueError:
            pass

    return None


def money(value):
    """
    Converte valores como:

    120
    120.50
    120,50
    R$ 120,50
    1.250,50
    """

    if value is None or value == "":
        return 0.0

    if isinstance(value, (int, float)):
        return float(value)

    s = str(value).strip()

    s = (
        s
        .replace("R$", "")
        .replace(" ", "")
    )

    if "," in s:

        s = (
            s
            .replace(".", "")
            .replace(",", ".")
        )

    return float(s)


def normalize_category(value):
    """
    Normaliza a categoria para o nome oficial.

    Exemplos:

    materiais  -> Materiais
    Materiais  -> Materiais
    MATERIAIS  -> Materiais
    """

    category = str(value or "").strip()

    if not category:
        return None

    normalized = category.casefold()

    if normalized not in CATEGORY_COLUMNS_NORMALIZED:
        return None

    column = CATEGORY_COLUMNS_NORMALIZED[normalized]

    for official_name, official_column in CATEGORY_COLUMNS.items():

        if official_column == column:
            return official_name

    return None


def get_next_rdd_number():

    con = db()

    try:

        con.execute("BEGIN IMMEDIATE")

        row = con.execute(
            """
            SELECT next_number
            FROM counters
            WHERE id=1
            """
        ).fetchone()

        if not row:
            raise RuntimeError(
                "Contador de RDD não encontrado."
            )

        number = int(row[0])

        con.execute(
            """
            UPDATE counters
            SET next_number=?
            WHERE id=1
            """,
            (number + 1,)
        )

        con.commit()

        return number

    except Exception:

        con.rollback()

        raise

    finally:

        con.close()


# ============================================================
# PREENCHIMENTO DO EXCEL
# ============================================================

def fill_workbook(
    payload,
    rdd_number,
    output_xlsx
):

    # --------------------------------------------------------
    # Abre o modelo original
    # --------------------------------------------------------

    wb = load_workbook(TEMPLATE)

    if "RDD" not in wb.sheetnames:

        raise RuntimeError(
            "Aba RDD não encontrada no modelo."
        )

    ws = wb["RDD"]


    # --------------------------------------------------------
    # CABEÇALHO
    # --------------------------------------------------------

    # Número do RDD
    ws["F3"] = f"RDD-{rdd_number:03d}"


    # --------------------------------------------------------
    # PERÍODO AUTOMÁTICO
    # --------------------------------------------------------

    today = date.today()

    first = today.replace(
        day=1
    )

    if today.month == 12:

        next_month = today.replace(
            year=today.year + 1,
            month=1,
            day=1
        )

    else:

        next_month = today.replace(
            month=today.month + 1,
            day=1
        )

    last = next_month.fromordinal(
        next_month.toordinal() - 1
    )


    ws["I3"] = first
    ws["K3"] = last

    ws["I3"].number_format = "dd/mm/yyyy"
    ws["K3"].number_format = "dd/mm/yyyy"


    # --------------------------------------------------------
    # DADOS FIXOS DO RDD PARCEIRO
    # --------------------------------------------------------

    # Finalidade
    ws["C3"] = "Reembolso de Pagamentos e Despesa"

    # Cargo
    ws["G5"] = "Prestador de Serviços"

    # Departamento
    ws["C6"] = "Projetos"

    # Gerente
    ws["G6"] = "Roberto Almeida Blanco"


    # --------------------------------------------------------
    # DADOS PREENCHIDOS PELO PARCEIRO
    # --------------------------------------------------------

    # Nome
    ws["C5"] = payload.get(
        "nome",
        ""
    )

    # CPF
    ws["K5"] = payload.get(
        "cpf",
        ""
    )

    # Obra
    ws["K6"] = payload.get(
        "obra",
        ""
    )


    # --------------------------------------------------------
    # LIMPA AS LINHAS DE DESPESAS
    # --------------------------------------------------------

    for row in range(9, 44):

        ws[f"B{row}"] = None
        ws[f"C{row}"] = None
        ws[f"D{row}"] = None
        ws[f"E{row}"] = None

        for col in "FGHIJK":

            ws[f"{col}{row}"] = None

        # Mantém a fórmula do total
        ws[f"L{row}"] = (
            f"=SUM(F{row}:K{row})"
        )


    # --------------------------------------------------------
    # RECEITAS / CUPONS
    # --------------------------------------------------------

    receipts = payload.get(
        "receipts",
        []
    )

    if not isinstance(
        receipts,
        list
    ):

        raise ValueError(
            "receipts deve ser uma lista."
        )


    # O modelo possui linhas 9 até 43
    if len(receipts) > 35:

        raise ValueError(
            "O modelo possui 35 linhas de despesas "
            "(9 a 43)."
        )


    # --------------------------------------------------------
    # PREENCHE CADA CUPOM
    # --------------------------------------------------------

    for idx, item in enumerate(
        receipts,
        start=9
    ):

        # ----------------------------------------------------
        # DATA
        # ----------------------------------------------------

        d = parse_date(
            item.get("date")
        )

        if d:

            ws[f"B{idx}"] = d

            ws[f"B{idx}"].number_format = (
                "dd/mm/yyyy"
            )


        # ----------------------------------------------------
        # CONTA
        # ----------------------------------------------------

        ws[f"C{idx}"] = item.get(
            "account",
            ""
        )


        # ----------------------------------------------------
        # DESCRIÇÃO
        # ----------------------------------------------------

        ws[f"D{idx}"] = item.get(
            "description",
            ""
        )


        # ----------------------------------------------------
        # DOCUMENTO
        # ----------------------------------------------------

        ws[f"E{idx}"] = item.get(
            "document",
            ""
        )


        # ----------------------------------------------------
        # CATEGORIA
        # ----------------------------------------------------

        original_category = item.get(
            "category",
            ""
        )

        category = normalize_category(
            original_category
        )

        if not category:

            raise ValueError(
                f"Categoria inválida: "
                f"{original_category}"
            )


        # ----------------------------------------------------
        # COLUNA DA CATEGORIA
        # ----------------------------------------------------

        category_column = (
            CATEGORY_COLUMNS[category]
        )


        # ----------------------------------------------------
        # VALOR
        # ----------------------------------------------------

        ws[
            f"{category_column}{idx}"
        ] = money(
            item.get("value")
        )


    # --------------------------------------------------------
    # ÁREA DE IMPRESSÃO
    # --------------------------------------------------------

    ws.print_area = "A1:L49"


    # --------------------------------------------------------
    # SALVA O EXCEL
    # --------------------------------------------------------

    wb.save(
        output_xlsx
    )


# ============================================================
# ANEXAR CUPONS AO PDF
# ============================================================

def append_images_to_pdf(
    pdf_path,
    image_files
):

    doc = fitz.open(
        pdf_path
    )


    for img_path in image_files:

        try:

            with Image.open(
                img_path
            ) as im:

                # --------------------------------------------
                # Converte para RGB
                # --------------------------------------------

                im = im.convert(
                    "RGB"
                )


                # --------------------------------------------
                # Limita resolução
                # --------------------------------------------

                max_side = 2200

                if max(im.size) > max_side:

                    ratio = (
                        max_side
                        /
                        max(im.size)
                    )

                    im = im.resize(
                        (
                            int(
                                im.width * ratio
                            ),
                            int(
                                im.height * ratio
                            )
                        )
                    )


                # --------------------------------------------
                # Compactação JPEG
                # --------------------------------------------

                buf = io.BytesIO()

                im.save(
                    buf,
                    format="JPEG",
                    quality=82,
                    optimize=True
                )


                # --------------------------------------------
                # Cria página A4
                # --------------------------------------------

                rect = fitz.Rect(
                    0,
                    0,
                    595,
                    842
                )

                page = doc.new_page(
                    width=rect.width,
                    height=rect.height
                )


                # --------------------------------------------
                # Área da imagem
                # --------------------------------------------

                margin = 18

                box = fitz.Rect(
                    margin,
                    margin,
                    rect.width - margin,
                    rect.height - margin
                )


                # --------------------------------------------
                # Insere imagem
                # --------------------------------------------

                page.insert_image(
                    box,
                    stream=buf.getvalue(),
                    keep_proportion=True,
                    overlay=True
                )


        except Exception as exc:

            raise ValueError(
                f"Não foi possível anexar "
                f"a imagem {img_path.name}: {exc}"
            )


    # --------------------------------------------------------
    # Salva PDF FINAL
    # --------------------------------------------------------

    final = pdf_path.with_name(
        pdf_path.stem + "_final.pdf"
    )


    doc.save(
        final,
        garbage=4,
        deflate=True
    )

    doc.close()


    return final


# ============================================================
# GERAR RDD
# ============================================================

@app.post("/api/generate")
async def generate(

    payload: str = Form(...),

    receipts: list[UploadFile] = File(
        default=[]
    ),
):

    # --------------------------------------------------------
    # VERIFICA MODELO
    # --------------------------------------------------------

    if not TEMPLATE.exists():

        raise HTTPException(
            500,
            "Modelo RDD.PARCEIRO.xlsx "
            "não encontrado no servidor."
        )


    # --------------------------------------------------------
    # LÊ JSON
    # --------------------------------------------------------

    try:

        data = json.loads(
            payload
        )

    except Exception:

        raise HTTPException(
            400,
            "Payload JSON inválido."
        )


    # --------------------------------------------------------
    # CAMPOS OBRIGATÓRIOS
    # --------------------------------------------------------

    required = [
        "nome",
        "cpf",
        "obra"
    ]


    missing = [
        field
        for field in required
        if not str(
            data.get(field, "")
        ).strip()
    ]


    if missing:

        raise HTTPException(
            400,
            "Campos obrigatórios ausentes: "
            + ", ".join(missing)
        )


    # --------------------------------------------------------
    # CUPONS
    # --------------------------------------------------------

    receipt_data = data.get(
        "receipts",
        []
    )


    if not receipt_data:

        raise HTTPException(
            400,
            "Nenhum cupom informado."
        )


    # --------------------------------------------------------
    # VALIDA CUPONS
    # --------------------------------------------------------

    for i, item in enumerate(
        receipt_data,
        1
    ):

        # Documento obrigatório
        if not str(
            item.get(
                "document",
                ""
            )
        ).strip():

            raise HTTPException(
                400,
                f"Cupom {i}: "
                "número do documento "
                "é obrigatório."
            )


        # Categoria obrigatória
        if not str(
            item.get(
                "category",
                ""
            )
        ).strip():

            raise HTTPException(
                400,
                f"Cupom {i}: "
                "categoria é obrigatória."
            )


        # ----------------------------------------------------
        # VALIDA CATEGORIA
        # ----------------------------------------------------

        normalized_category = normalize_category(
            item.get(
                "category"
            )
        )


        if not normalized_category:

            raise HTTPException(
                400,
                f"Cupom {i}: "
                f"categoria inválida: "
                f"{item.get('category')}"
            )


        # ----------------------------------------------------
        # NORMALIZA A CATEGORIA
        #
        # Isso faz com que:
        #
        # materiais
        # Materiais
        # MATERIAIS
        #
        # virem oficialmente:
        #
        # Materiais
        # ----------------------------------------------------

        item["category"] = (
            normalized_category
        )


    # --------------------------------------------------------
    # GERA NÚMERO DO RDD
    # --------------------------------------------------------

    rdd_number = get_next_rdd_number()


    # --------------------------------------------------------
    # CRIA DIRETÓRIO TEMPORÁRIO
    # --------------------------------------------------------

    workdir = Path(
        tempfile.mkdtemp(
            prefix="rdd_"
        )
    )


    xlsx = (
        workdir
        /
        f"RDD-{rdd_number:03d}.xlsx"
    )


    pdf = (
        workdir
        /
        f"RDD-{rdd_number:03d}.pdf"
    )


    try:

        # ----------------------------------------------------
        # PREENCHE EXCEL
        # ----------------------------------------------------

        fill_workbook(
            data,
            rdd_number,
            xlsx
        )


        # ----------------------------------------------------
        # EXCEL -> PDF
        # ----------------------------------------------------

        cmd = [
            "libreoffice",
            "--headless",
            "--convert-to",
            "pdf",
            "--outdir",
            str(workdir),
            str(xlsx)
        ]


        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=90
        )


        if (
            proc.returncode != 0
            or not pdf.exists()
        ):

            raise RuntimeError(
                "Falha na conversão "
                "Excel -> PDF. "
                +
                (
                    proc.stderr
                    or proc.stdout
                    or ""
                )
            )


        # ----------------------------------------------------
        # SALVA OS CUPONS
        # ----------------------------------------------------

        image_paths = []


        for i, upload in enumerate(
            receipts
        ):

            suffix = (
                Path(
                    upload.filename or ""
                ).suffix.lower()
                or ".jpg"
            )


            p = (
                workdir
                /
                f"cupom_{i + 1}{suffix}"
            )


            content = await upload.read()


            if not content:
                continue


            p.write_bytes(
                content
            )


            image_paths.append(
                p
            )


        # ----------------------------------------------------
        # JUNTA CUPONS AO PDF
        # ----------------------------------------------------

        if image_paths:

            final_pdf = append_images_to_pdf(
                pdf,
                image_paths
            )

        else:

            final_pdf = pdf


        # ----------------------------------------------------
        # RETORNA PDF
        # ----------------------------------------------------

        return FileResponse(
            final_pdf,
            media_type="application/pdf",
            filename=(
                f"RDD-{rdd_number:03d}.pdf"
            ),
            background=None
        )


    except HTTPException:

        raise


    except Exception as exc:

        raise HTTPException(
            500,
            f"Erro ao gerar RDD: {exc}"
        )


# ============================================================
# EXECUÇÃO LOCAL
# ============================================================

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=int(
            os.getenv(
                "PORT",
                "8000"
            )
        )
    )
