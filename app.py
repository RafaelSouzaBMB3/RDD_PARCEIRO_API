import os
import io
import json
import sqlite3
import tempfile
import subprocess
import shutil

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
# CONFIGURAÇÃO
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
# CATEGORIAS DO EXCEL
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
# FASTAPI
# ============================================================

app = FastAPI(
    title="RDD Parceiro BMB3 API",
    version="2.0.0"
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

    con.execute(
        "PRAGMA journal_mode=WAL"
    )

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
        VALUES (1, 210)
        """
    )

    # --------------------------------------------------------
    # CORREÇÃO DE MIGRAÇÃO
    #
    # Se algum teste antigo deixou a sequência em 112,
    # 113 etc., o sistema volta para 210.
    #
    # Depois que chegar em 210, segue normalmente:
    # 210 → 211 → 212 → ...
    # --------------------------------------------------------

    row = con.execute(
        """
        SELECT next_number
        FROM counters
        WHERE id = 1
        """
    ).fetchone()

    if row:

        atual = int(row[0])

        if atual < 210:

            con.execute(
                """
                UPDATE counters
                SET next_number = 210
                WHERE id = 1
                """
            )

    con.commit()

    con.close()


@app.on_event("startup")
def startup():

    init_db()


# ============================================================
# ROTAS
# ============================================================

@app.get("/")
def root():

    return {
        "ok": True,
        "service": "RDD Parceiro BMB3 API",
        "version": "2.0.0"
    }


@app.get("/health")
def health():

    return {
        "ok": True,
        "template": TEMPLATE.exists(),
        "template_path": str(TEMPLATE),
        "version": "2.0.0"
    }


# ============================================================
# DATA
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


# ============================================================
# VALOR
# ============================================================

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

    try:

        return float(s)

    except ValueError:

        return 0.0


# ============================================================
# PRÓXIMO RDD
# ============================================================

def get_next_rdd_number():

    con = db()

    try:

        con.execute(
            "BEGIN IMMEDIATE"
        )

        row = con.execute(
            """
            SELECT next_number
            FROM counters
            WHERE id = 1
            """
        ).fetchone()

        if not row:

            n = 210

            con.execute(
                """
                INSERT INTO counters
                (id, next_number)
                VALUES (1, ?)
                """,
                (211,)
            )

        else:

            n = int(
                row[0]
            )

            # Segurança:
            # nunca gerar número abaixo de 210.

            if n < 210:

                n = 210

            con.execute(
                """
                UPDATE counters
                SET next_number = ?
                WHERE id = 1
                """,
                (n + 1,)
            )

        con.commit()

        return n

    except Exception:

        con.rollback()

        raise

    finally:

        con.close()


# ============================================================
# PERÍODO DO MÊS ATUAL
# ============================================================

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
# LIMPEZA DAS LINHAS DE DESPESAS
# ============================================================

def clear_expense_rows(ws):

    for row in range(9, 44):

        # Data
        ws[f"B{row}"] = None

        # Conta
        ws[f"C{row}"] = None

        # Descrição
        ws[f"D{row}"] = None

        # Documento
        ws[f"E{row}"] = None

        # Categorias
        for col in "FGHIJK":

            ws[f"{col}{row}"] = None

        # Total da linha
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

    # ========================================================
    # IMPORTANTE
    #
    # output_xlsx é uma CÓPIA TEMPORÁRIA do template.
    # O arquivo original nunca é aberto para gravação.
    # ========================================================

    shutil.copy2(
        TEMPLATE,
        output_xlsx
    )


    # Abre a cópia temporária
    wb = load_workbook(
        output_xlsx
    )


    if "RDD" not in wb.sheetnames:

        wb.close()

        raise RuntimeError(
            "Aba RDD não encontrada no modelo."
        )


    ws = wb["RDD"]


    # ========================================================
    # DADOS FIXOS DO RDD PARCEIRO
    # ========================================================

    # --------------------------------------------------------
    # C3 - Finalidade
    # --------------------------------------------------------

    ws["C3"] = (
        "Reembolso de Pagamentos e Despesa"
    )


    # --------------------------------------------------------
    # F3 - Número do demonstrativo
    # --------------------------------------------------------

    ws["F3"] = (
        f"RDD-{rdd_number:03d}"
    )


    # --------------------------------------------------------
    # I3 / K3 - Período
    # --------------------------------------------------------

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


    # --------------------------------------------------------
    # C5 - Nome
    # --------------------------------------------------------

    ws["C5"] = str(
        payload.get(
            "nome",
            ""
        )
    ).strip()


    # --------------------------------------------------------
    # G5 - Cargo
    # --------------------------------------------------------

    ws["G5"] = (
        "Prestador de Serviços"
    )


    # --------------------------------------------------------
    # K5 - CPF
    # --------------------------------------------------------

    ws["K5"] = str(
        payload.get(
            "cpf",
            ""
        )
    ).strip()


    # --------------------------------------------------------
    # C6 - Departamento
    # --------------------------------------------------------

    ws["C6"] = (
        "Projetos"
    )


    # --------------------------------------------------------
    # G6 - Gerente
    # --------------------------------------------------------

    ws["G6"] = (
        "Roberto Almeida Blanco"
    )


    # --------------------------------------------------------
    # K6 - Obra
    # --------------------------------------------------------

    ws["K6"] = str(
        payload.get(
            "obra",
            ""
        )
    ).strip()


    # ========================================================
    # LIMPA AS DESPESAS EXISTENTES DO TEMPLATE
    # ========================================================

    clear_expense_rows(
        ws
    )


    # ========================================================
    # CUPONS
    # ========================================================

    receipts = payload.get(
        "receipts",
        []
    )


    if not isinstance(
        receipts,
        list
    ):

        wb.close()

        raise ValueError(
            "receipts deve ser uma lista."
        )


    if len(receipts) > 35:

        wb.close()

        raise ValueError(
            "O modelo possui 35 linhas "
            "de despesas, das linhas 9 a 43."
        )


    # ========================================================
    # PREENCHER CADA CUPOM
    # ========================================================

    for row, item in enumerate(
        receipts,
        start=9
    ):

        # ----------------------------------------------------
        # DATA
        # ----------------------------------------------------

        d = parse_date(
            item.get(
                "date"
            )
        )

        if d:

            ws[f"B{row}"] = d

            ws[f"B{row}"].number_format = (
                "dd/mm/yyyy"
            )


        # ----------------------------------------------------
        # CONTA
        # ----------------------------------------------------

        ws[f"C{row}"] = str(
            item.get(
                "account",
                ""
            )
        ).strip()


        # ----------------------------------------------------
        # DESCRIÇÃO
        # ----------------------------------------------------

        ws[f"D{row}"] = str(
            item.get(
                "description",
                ""
            )
        ).strip()


        # ----------------------------------------------------
        # DOCUMENTO
        # ----------------------------------------------------

        document = str(
            item.get(
                "document",
                ""
            )
        ).strip()


        if not document:

            wb.close()

            raise ValueError(
                f"Cupom {row - 8}: "
                "número do documento é obrigatório."
            )


        ws[f"E{row}"] = document


        # ----------------------------------------------------
        # CATEGORIA
        #
        # RDD PARCEIRO:
        # SEMPRE MATERIAIS
        # ----------------------------------------------------

        category = "Materiais"

        category_column = (
            CATEGORY_COLUMNS[
                category
            ]
        )


        # ----------------------------------------------------
        # VALOR
        # ----------------------------------------------------

        ws[
            f"{category_column}{row}"
        ] = money(
            item.get(
                "value",
                0
            )
        )


    # ========================================================
    # ÁREA DE IMPRESSÃO
    #
    # Mantém o modelo real do Excel.
    # ========================================================

    ws.print_area = (
        "A1:L49"
    )


    # ========================================================
    # SALVA SOMENTE A CÓPIA
    # ========================================================

    wb.save(
        output_xlsx
    )

    wb.close()


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

            # ------------------------------------------------
            # PIL + pillow-heif
            # permite JPG / PNG / HEIC / HEIF
            # ------------------------------------------------

            with Image.open(
                img_path
            ) as im:

                im = im.convert(
                    "RGB"
                )


                # --------------------------------------------
                # Reduz imagens gigantes
                # --------------------------------------------

                max_side = 2200

                if max(im.size) > max_side:

                    ratio = (
                        max_side
                        / max(im.size)
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
                # JPEG otimizado
                # --------------------------------------------

                buffer = io.BytesIO()

                im.save(
                    buffer,
                    format="JPEG",
                    quality=82,
                    optimize=True
                )


                # --------------------------------------------
                # Nova página A4
                # --------------------------------------------

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


    # ========================================================
    # PDF FINAL
    # ========================================================

    final_pdf = (
        pdf_path.parent
        / f"{pdf_path.stem}_final.pdf"
    )


    doc.save(
        final_pdf,
        garbage=4,
        deflate=True
    )

    doc.close()


    return final_pdf


# ============================================================
# LIMPEZA DO DIRETÓRIO TEMPORÁRIO
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

    # ========================================================
    # VERIFICA TEMPLATE
    # ========================================================

    if not TEMPLATE.exists():

        raise HTTPException(
            status_code=500,
            detail=(
                "Modelo RDD.PARCEIRO.xlsx "
                "não encontrado no servidor."
            )
        )


    # ========================================================
    # LÊ JSON
    # ========================================================

    try:

        data = json.loads(
            payload
        )

    except Exception:

        raise HTTPException(
            status_code=400,
            detail="Payload JSON inválido."
        )


    # ========================================================
    # CAMPOS OBRIGATÓRIOS
    # ========================================================

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


    # ========================================================
    # CUPONS
    # ========================================================

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


    # ========================================================
    # VALIDA CUPONS
    # ========================================================

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
                    "número do documento "
                    "é obrigatório."
                )
            )


        # ----------------------------------------------------
        # FORÇA MATERIAIS
        # ----------------------------------------------------

        item["category"] = (
            "Materiais"
        )


    # ========================================================
    # NÚMERO DO RDD
    # ========================================================

    rdd_number = (
        get_next_rdd_number()
    )


    # ========================================================
    # DIRETÓRIO TEMPORÁRIO
    # ========================================================

    workdir = Path(
        tempfile.mkdtemp(
            prefix="rdd_"
        )
    )


    # ========================================================
    # ARQUIVOS TEMPORÁRIOS
    # ========================================================

    xlsx = (
        workdir
        / f"RDD-{rdd_number:03d}.xlsx"
    )


    pdf = (
        workdir
        / f"RDD-{rdd_number:03d}.pdf"
    )


    try:

        # ====================================================
        # 1. COPIA O TEMPLATE
        # 2. PREENCHE A CÓPIA
        # ====================================================

        fill_workbook(
            data,
            rdd_number,
            xlsx
        )


        # ====================================================
        # CONVERTE A CÓPIA DO EXCEL PARA PDF
        # ====================================================

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


        # ====================================================
        # RECEBE OS CUPONS
        # ====================================================

        image_paths = []


        for i, upload in enumerate(
            receipts,
            start=1
        ):

            filename = (
                upload.filename
                or ""
            )


            suffix = Path(
                filename
            ).suffix.lower()


            if not suffix:

                suffix = ".jpg"


            image_path = (
                workdir
                / f"cupom_{i}{suffix}"
            )


            content = (
                await upload.read()
            )


            if not content:

                continue


            image_path.write_bytes(
                content
            )


            image_paths.append(
                image_path
            )


        # ====================================================
        # ANEXA OS CUPONS
        # ====================================================

        if image_paths:

            final_pdf = (
                append_images_to_pdf(
                    pdf,
                    image_paths
                )
            )

        else:

            final_pdf = pdf


        # ====================================================
        # RETORNA O PDF
        #
        # O diretório temporário só será apagado DEPOIS
        # que o FastAPI terminar de enviar o arquivo.
        # ====================================================

        background = BackgroundTask(
            cleanup_workdir,
            workdir
        )


        return FileResponse(

            path=final_pdf,

            media_type="application/pdf",

            filename=(
                f"RDD-{rdd_number:03d}.pdf"
            ),

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
