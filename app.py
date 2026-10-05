import os
import io
import json
import sqlite3
import tempfile
import subprocess
import shutil
import re

from datetime import date, datetime
from pathlib import Path

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    HTTPException
)

from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from openpyxl import load_workbook

from PIL import Image
from pillow_heif import register_heif_opener

import fitz  # PyMuPDF


# ============================================================
# HEIC / HEIF
# ============================================================

register_heif_opener()


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

DATA_DIR.mkdir(
    parents=True,
    exist_ok=True
)

DB_PATH = DATA_DIR / "rdd.db"


# ============================================================
# CATEGORIAS
# ============================================================

CATEGORY_COLUMNS = {
    "Transporte": "F",
    "Combustível": "G",
    "Refeições": "H",
    "Hospedagem": "I",
    "Materiais": "J",
    "Diversos": "K",
}


# ============================================================
# API
# ============================================================

app = FastAPI(
    title="RDD Parceiro BMB3 API",
    version="2.1.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# BANCO DE DADOS / NUMERAÇÃO
# ============================================================

def db():
    con = sqlite3.connect(
        DB_PATH,
        timeout=30
    )

    con.execute(
        "PRAGMA journal_mode=WAL"
    )

    return con


def init_db():

    con = db()

    con.execute("""
        CREATE TABLE IF NOT EXISTS counters (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            next_number INTEGER NOT NULL
        )
    """)

    con.execute("""
        INSERT OR IGNORE INTO counters
        (id, next_number)
        VALUES (1, 210)
    """)

    row = con.execute("""
        SELECT next_number
        FROM counters
        WHERE id = 1
    """).fetchone()

    if row:

        atual = int(row[0])

        if atual < 210:

            con.execute("""
                UPDATE counters
                SET next_number = 210
                WHERE id = 1
            """)

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
        "service": "RDD Parceiro BMB3 API",
        "version": "2.1.0"
    }


@app.get("/health")
def health():

    return {
        "ok": True,
        "template": TEMPLATE.exists(),
        "template_path": str(TEMPLATE),
        "version": "2.1.0"
    }


# ============================================================
# FUNÇÕES AUXILIARES
# ============================================================

def parse_date(value):

    if not value:
        return None

    s = str(value).strip()

    formatos = (
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%d-%m-%Y"
    )

    for fmt in formatos:

        try:
            return datetime.strptime(
                s,
                fmt
            ).date()

        except ValueError:
            pass

    return None


def money(value):

    if value is None:
        return 0.0

    if value == "":
        return 0.0

    if isinstance(
        value,
        (int, float)
    ):
        return float(value)

    s = str(value).strip()

    s = s.replace(
        "R$",
        ""
    )

    s = s.replace(
        " ",
        ""
    )

    if "," in s:

        s = s.replace(
            ".",
            ""
        )

        s = s.replace(
            ",",
            "."
        )

    try:

        return float(s)

    except ValueError:

        return 0.0


def safe_filename(name):

    """
    Remove caracteres inválidos para nome de arquivo.
    """

    name = str(name or "").strip()

    if not name:

        name = "Responsavel"

    name = re.sub(
        r'[<>:"/\\|?*\x00-\x1F]',
        "",
        name
    )

    name = re.sub(
        r"\s+",
        " ",
        name
    )

    return name[:120]


def get_next_rdd_number():

    con = db()

    try:

        con.execute(
            "BEGIN IMMEDIATE"
        )

        row = con.execute("""
            SELECT next_number
            FROM counters
            WHERE id = 1
        """).fetchone()

        if not row:

            n = 210

            con.execute("""
                INSERT INTO counters
                (id, next_number)
                VALUES (1, ?)
            """, (211,))

        else:

            n = int(row[0])

            if n < 210:
                n = 210

            con.execute("""
                UPDATE counters
                SET next_number = ?
                WHERE id = 1
            """, (n + 1,))

        con.commit()

        return n

    except Exception:

        con.rollback()

        raise

    finally:

        con.close()


def current_month_period():

    today = date.today()

    first_day = today.replace(
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

    last_day = next_month.fromordinal(
        next_month.toordinal() - 1
    )

    return (
        first_day,
        last_day
    )


# ============================================================
# MANTER SOMENTE A ABA RDD
# ============================================================

def keep_only_rdd_sheet(wb):

    if "RDD" not in wb.sheetnames:

        raise RuntimeError(
            "A aba 'RDD' não foi encontrada no modelo."
        )

    # --------------------------------------------------------
    # Remove todas as abas que não sejam RDD
    # --------------------------------------------------------

    for sheet_name in list(wb.sheetnames):

        if sheet_name != "RDD":

            ws_remove = wb[sheet_name]

            wb.remove(ws_remove)

    # --------------------------------------------------------
    # Garante que RDD esteja visível
    # --------------------------------------------------------

    ws = wb["RDD"]

    ws.sheet_state = "visible"

    # --------------------------------------------------------
    # Define RDD como aba ativa
    # --------------------------------------------------------

    wb.active = wb.index(ws)

    return ws


# ============================================================
# LIMPA AS LINHAS DE DESPESAS
# ============================================================

def clear_expense_rows(ws):

    for row in range(9, 44):

        ws[f"B{row}"] = None
        ws[f"C{row}"] = None
        ws[f"D{row}"] = None
        ws[f"E{row}"] = None

        for col in "FGHIJK":

            ws[f"{col}{row}"] = None

        # Mantém o cálculo do total da linha

        ws[f"L{row}"] = (
            f"=SUM(F{row}:K{row})"
        )


# ============================================================
# PREENCHIMENTO DO EXCEL
# ============================================================

def fill_workbook(
    payload,
    rdd_number,
    output_xlsx
):

    # --------------------------------------------------------
    # 1. Copia o template original
    # --------------------------------------------------------

    shutil.copy2(
        TEMPLATE,
        output_xlsx
    )

    # --------------------------------------------------------
    # 2. Abre somente a cópia
    # --------------------------------------------------------

    wb = load_workbook(
        output_xlsx
    )

    try:

        # ----------------------------------------------------
        # 3. Mantém somente a aba RDD
        # ----------------------------------------------------

        ws = keep_only_rdd_sheet(
            wb
        )

        # ----------------------------------------------------
        # 4. CAMPOS FIXOS
        # ----------------------------------------------------

        ws["C3"] = (
            "Reembolso de Pagamentos e Despesa"
        )

        # ----------------------------------------------------
        # 5. NÚMERO DO RDD
        # ----------------------------------------------------

        ws["F3"] = (
            f"RDD-{rdd_number:03d}"
        )

        # ----------------------------------------------------
        # 6. PERÍODO
        # ----------------------------------------------------

        first_day, last_day = (
            current_month_period()
        )

        ws["I3"] = first_day
        ws["K3"] = last_day

        ws["I3"].number_format = (
            "dd/mm/yyyy"
        )

        ws["K3"].number_format = (
            "dd/mm/yyyy"
        )

        # ----------------------------------------------------
        # 7. NOME
        #
        # Nome = pessoa que preencheu o HTML
        # ----------------------------------------------------

        ws["C5"] = str(
            payload.get(
                "nome",
                ""
            )
        ).strip()

        # ----------------------------------------------------
        # 8. CARGO
        # ----------------------------------------------------

        ws["G5"] = (
            "Prestador de Serviços"
        )

        # ----------------------------------------------------
        # 9. CPF
        # ----------------------------------------------------

        ws["K5"] = str(
            payload.get(
                "cpf",
                ""
            )
        ).strip()

        # ----------------------------------------------------
        # 10. DEPARTAMENTO
        # ----------------------------------------------------

        ws["C6"] = (
            "Projetos"
        )

        # ----------------------------------------------------
        # 11. GERENTE
        # ----------------------------------------------------

        ws["G6"] = (
            "Roberto Almeida Blanco"
        )

        # ----------------------------------------------------
        # 12. OBRA
        # ----------------------------------------------------

        ws["K6"] = str(
            payload.get(
                "obra",
                ""
            )
        ).strip()

        # ----------------------------------------------------
        # 13. LIMPA TODAS AS DESPESAS
        # ----------------------------------------------------

        clear_expense_rows(
            ws
        )

        # ----------------------------------------------------
        # 14. RECEITAS / CUPONS
        # ----------------------------------------------------

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

        if len(receipts) > 35:

            raise ValueError(
                "O modelo possui 35 linhas de despesas, "
                "das linhas 9 a 43."
            )

        # ----------------------------------------------------
        # 15. PREENCHE CADA CUPOM
        # ----------------------------------------------------

        for row, item in enumerate(
            receipts,
            start=9
        ):

            # -----------------------------------------------
            # DATA
            # -----------------------------------------------

            d = parse_date(
                item.get("date")
            )

            if d:

                ws[f"B{row}"] = d

                ws[f"B{row}"].number_format = (
                    "dd/mm/yyyy"
                )

            # -----------------------------------------------
            # CONTA
            # -----------------------------------------------

            ws[f"C{row}"] = str(
                item.get(
                    "account",
                    ""
                )
            ).strip()

            # -----------------------------------------------
            # DESCRIÇÃO
            # -----------------------------------------------

            ws[f"D{row}"] = str(
                item.get(
                    "description",
                    ""
                )
            ).strip()

            # -----------------------------------------------
            # DOCUMENTO
            # -----------------------------------------------

            document = str(
                item.get(
                    "document",
                    ""
                )
            ).strip()

            if not document:

                raise ValueError(
                    f"Cupom {row - 8}: "
                    "número do documento é obrigatório."
                )

            ws[f"E{row}"] = document

            # -----------------------------------------------
            # CATEGORIA
            #
            # RDD PARCEIRO = SEMPRE MATERIAIS
            # -----------------------------------------------

            category = "Materiais"

            category_column = (
                CATEGORY_COLUMNS[
                    category
                ]
            )

            ws[
                f"{category_column}{row}"
            ] = money(
                item.get(
                    "value",
                    0
                )
            )

        # ----------------------------------------------------
        # 16. ÁREA DE IMPRESSÃO
        # ----------------------------------------------------

        ws.print_area = (
            "A1:L49"
        )

        # ----------------------------------------------------
        # 17. Garante que a aba RDD seja a ativa
        # ----------------------------------------------------

        wb.active = wb.index(
            ws
        )

        # ----------------------------------------------------
        # 18. SALVA SOMENTE A CÓPIA TEMPORÁRIA
        # ----------------------------------------------------

        wb.save(
            output_xlsx
        )

    finally:

        # ----------------------------------------------------
        # Fecha o Excel temporário
        # ----------------------------------------------------

        wb.close()


# ============================================================
# ANEXAR IMAGENS DOS CUPONS AO PDF
# ============================================================

def append_images_to_pdf(
    pdf_path,
    image_files
):

    doc = fitz.open(
        pdf_path
    )

    try:

        for img_path in image_files:

            try:

                with Image.open(
                    img_path
                ) as im:

                    im = im.convert(
                        "RGB"
                    )

                    max_side = 2200

                    if max(im.size) > max_side:

                        ratio = (
                            max_side /
                            max(im.size)
                        )

                        im = im.resize(
                            (
                                int(
                                    im.width *
                                    ratio
                                ),
                                int(
                                    im.height *
                                    ratio
                                )
                            )
                        )

                    buffer = io.BytesIO()

                    im.save(
                        buffer,
                        format="JPEG",
                        quality=82,
                        optimize=True
                    )

                    page = doc.new_page(
                        width=595,
                        height=842
                    )

                    margin = 18

                    box = fitz.Rect(
                        margin,
                        margin,
                        595 - margin,
                        842 - margin
                    )

                    page.insert_image(
                        box,
                        stream=buffer.getvalue(),
                        keep_proportion=True,
                        overlay=True
                    )

            except Exception as exc:

                raise ValueError(
                    "Não foi possível anexar a imagem "
                    f"{img_path.name}: {exc}"
                )

        final_pdf = (
            pdf_path.parent /
            f"{pdf_path.stem}_com_cupons.pdf"
        )

        doc.save(
            final_pdf,
            garbage=4,
            deflate=True
        )

        return final_pdf

    finally:

        doc.close()


# ============================================================
# LIMPEZA DOS ARQUIVOS TEMPORÁRIOS
# ============================================================

def cleanup_workdir(
    workdir
):

    try:

        shutil.rmtree(
            workdir,
            ignore_errors=True
        )

    except Exception:

        pass


# ============================================================
# GERAR RDD
# ============================================================

@app.post("/api/generate")
async def generate(

    payload: str = Form(...),

    receipts: list[UploadFile] = File(
        default=[]
    )
):

    # --------------------------------------------------------
    # VERIFICA TEMPLATE
    # --------------------------------------------------------

    if not TEMPLATE.exists():

        raise HTTPException(
            status_code=500,
            detail=(
                "Modelo RDD.PARCEIRO.xlsx "
                "não encontrado no servidor."
            )
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
            status_code=400,
            detail="Payload JSON inválido."
        )

    # --------------------------------------------------------
    # CAMPOS OBRIGATÓRIOS
    # --------------------------------------------------------

    required = [
        "nome",
        "cpf",
        "obra"
    ]

    missing = []

    for field in required:

        if not str(
            data.get(
                field,
                ""
            )
        ).strip():

            missing.append(
                field
            )

    if missing:

        raise HTTPException(
            status_code=400,
            detail=(
                "Campos obrigatórios ausentes: "
                + ", ".join(missing)
            )
        )

    # --------------------------------------------------------
    # RECEITAS
    # --------------------------------------------------------

    receipt_data = data.get(
        "receipts",
        []
    )

    if not receipt_data:

        raise HTTPException(
            status_code=400,
            detail="Nenhum cupom informado."
        )

    if not isinstance(
        receipt_data,
        list
    ):

        raise HTTPException(
            status_code=400,
            detail="Lista de cupons inválida."
        )

    # --------------------------------------------------------
    # VALIDA DOCUMENTOS
    # --------------------------------------------------------

    for i, item in enumerate(
        receipt_data,
        start=1
    ):

        document = str(
            item.get(
                "document",
                ""
            )
        ).strip()

        if not document:

            raise HTTPException(
                status_code=400,
                detail=(
                    f"Cupom {i}: "
                    "número do documento é obrigatório."
                )
            )

        # ----------------------------------------------------
        # RDD PARCEIRO = MATERIAIS
        # ----------------------------------------------------

        item["category"] = (
            "Materiais"
        )

    # --------------------------------------------------------
    # PEGA NÚMERO DO RDD
    # --------------------------------------------------------

    rdd_number = (
        get_next_rdd_number()
    )

    # --------------------------------------------------------
    # NOME DO RESPONSÁVEL
    # --------------------------------------------------------

    nome_responsavel = safe_filename(
        data.get(
            "nome",
            "Responsavel"
        )
    )

    rdd_codigo = (
        f"RDD-{rdd_number:03d}"
    )

    # --------------------------------------------------------
    # NOME FINAL DO PDF
    # --------------------------------------------------------

    final_filename = (
        f"{nome_responsavel} - "
        f"{rdd_codigo}.pdf"
    )

    # --------------------------------------------------------
    # DIRETÓRIO TEMPORÁRIO
    # --------------------------------------------------------

    workdir = Path(
        tempfile.mkdtemp(
            prefix="rdd_"
        )
    )

    xlsx = (
        workdir /
        f"{rdd_codigo}.xlsx"
    )

    pdf = (
        workdir /
        f"{rdd_codigo}.pdf"
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
        # CONVERTE EXCEL -> PDF
        #
        # Como já removemos todas as abas e deixamos somente
        # RDD, o LibreOffice produzirá somente essa página.
        # ----------------------------------------------------

        command = [
            "libreoffice",
            "--headless",
            "--convert-to",
            "pdf",
            "--outdir",
            str(workdir),
            str(xlsx)
        ]

        process = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=90
        )

        if (
            process.returncode != 0
            or not pdf.exists()
        ):

            raise RuntimeError(
                "Falha na conversão "
                "Excel -> PDF. "
                + (
                    process.stderr
                    or process.stdout
                    or ""
                )
            )

        # ----------------------------------------------------
        # SALVA AS IMAGENS DOS CUPONS
        # ----------------------------------------------------

        image_paths = []

        for i, upload in enumerate(
            receipts,
            start=1
        ):

            filename = (
                upload.filename
                or ""
            )

            suffix = (
                Path(filename)
                .suffix
                .lower()
            )

            if not suffix:

                suffix = ".jpg"

            image_path = (
                workdir /
                f"cupom_{i}{suffix}"
            )

            content = await upload.read()

            if not content:

                continue

            image_path.write_bytes(
                content
            )

            image_paths.append(
                image_path
            )

        # ----------------------------------------------------
        # ANEXA CUPONS
        # ----------------------------------------------------

        if image_paths:

            final_pdf = (
                append_images_to_pdf(
                    pdf,
                    image_paths
                )
            )

        else:

            final_pdf = pdf

        # ----------------------------------------------------
        # ENVIA PDF
        #
        # O nome exibido para download será:
        #
        # Rafael Souza - RDD-211.pdf
        # ----------------------------------------------------

        background = BackgroundTask(
            cleanup_workdir,
            workdir
        )

        return FileResponse(
            path=final_pdf,
            media_type="application/pdf",
            filename=final_filename,
            background=background
        )

    except HTTPException:

        cleanup_workdir(
            workdir
        )

        raise

    except Exception as exc:

        cleanup_workdir(
            workdir
        )

        raise HTTPException(
            status_code=500,
            detail=(
                f"Erro ao gerar RDD: {exc}"
            )
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
