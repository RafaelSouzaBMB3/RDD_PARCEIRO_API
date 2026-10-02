# RDD PARCEIRO API - BMB3

Backend para o sistema RDD Parceiro.

## O que esta API faz

- Recebe os dados preenchidos no celular.
- Usa `template/RDD.PARCEIRO.xlsx` como modelo oficial.
- Preenche a aba `RDD`.
- Gera números sequenciais começando em RDD-210.
- Calcula o período do mês atual.
- Converte o Excel para PDF usando LibreOffice.
- Acrescenta as fotos dos cupons ao final do PDF.
- Valida CPF/Nome/Obra e Documento/Categoria dos cupons.

## Endpoint

GET `/health`

POST `/api/generate`

O frontend enviará `multipart/form-data` com:
- `payload`: JSON
- `receipts`: arquivos de imagem

## Importante

Para manter a sequência dos RDDs depois de reinícios/redeploys, o diretório `/data` precisa ser persistente no ambiente de hospedagem.
