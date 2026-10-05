```javascript
/* =========================================================
   RDD PARCEIRO BMB3
   Controle da interface + integração com API Render
   ========================================================= */

const API_URL = "https://rdd-parceiro-api-1.onrender.com";

let receipts = [];
let currentEditIndex = null;


/* =========================================================
   ELEMENTOS
   ========================================================= */

const nome = document.getElementById("nome");
const cpf = document.getElementById("cpf");
const obra = document.getElementById("obra");
const periodo = document.getElementById("periodo");

const filesInput = document.getElementById("files");
const pickButton = document.getElementById("pick");

const list = document.getElementById("list");
const count = document.getElementById("count");
const sum = document.getElementById("sum");

const review = document.getElementById("review");
const message = document.getElementById("message");


/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    definirPeriodo();

    configurarEventos();

    atualizarInterface();

});


/* =========================================================
   EVENTOS
   ========================================================= */

function configurarEventos() {

    /*
       ETAPA 1
    */

    document.getElementById("next1")
        .addEventListener("click", () => {

            if (!validarDados()) {
                return;
            }

            mostrarTela("cupons");

        });


    /*
       CUPONS
    */

    pickButton.addEventListener("click", () => {

        filesInput.click();

    });


    filesInput.addEventListener("change", (event) => {

        adicionarArquivos(event.target.files);

        /*
           Permite selecionar novamente o mesmo arquivo
        */

        filesInput.value = "";

    });


    document.getElementById("back1")
        .addEventListener("click", () => {

            mostrarTela("dados");

        });


    document.getElementById("next2")
        .addEventListener("click", () => {

            if (!validarCupons()) {
                return;
            }

            montarRevisao();

            mostrarTela("revisao");

        });


    /*
       REVISÃO
    */

    document.getElementById("back2")
        .addEventListener("click", () => {

            mostrarTela("cupons");

        });


    document.getElementById("generate")
        .addEventListener("click", gerarRDD);


    /*
       NOVO RDD
    */

    document.getElementById("new")
        .addEventListener("click", novoRDD);


    /*
       MODAL
    */

    document.getElementById("close")
        .addEventListener("click", fecharModal);


    document.getElementById("save")
        .addEventListener("click", salvarCupom);


    /*
       Fecha modal clicando fora
    */

    document.getElementById("modal")
        .addEventListener("click", (event) => {

            if (event.target.id === "modal") {

                fecharModal();

            }

        });

}


/* =========================================================
   PERÍODO
   ========================================================= */

function definirPeriodo() {

    const hoje = new Date();

    const primeiroDia = new Date(
        hoje.getFullYear(),
        hoje.getMonth(),
        1
    );

    const ultimoDia = new Date(
        hoje.getFullYear(),
        hoje.getMonth() + 1,
        0
    );


    const inicio = formatarDataBR(primeiroDia);
    const fim = formatarDataBR(ultimoDia);


    periodo.value = `${inicio} até ${fim}`;

}


/* =========================================================
   DATA
   ========================================================= */

function formatarDataBR(data) {

    return data.toLocaleDateString(
        "pt-BR"
    );

}


function dataInputHoje() {

    const hoje = new Date();

    const ano = hoje.getFullYear();

    const mes = String(
        hoje.getMonth() + 1
    ).padStart(2, "0");

    const dia = String(
        hoje.getDate()
    ).padStart(2, "0");


    return `${ano}-${mes}-${dia}`;

}


/* =========================================================
   VALIDAÇÃO DOS DADOS
   ========================================================= */

function validarDados() {

    const nomeValor = nome.value.trim();
    const cpfValor = cpf.value.trim();
    const obraValor = obra.value.trim();


    if (!nomeValor) {

        alert("Informe o nome completo.");

        nome.focus();

        return false;

    }


    if (!cpfValor) {

        alert("Informe o CPF.");

        cpf.focus();

        return false;

    }


    const cpfNumeros =
        cpfValor.replace(/\D/g, "");


    if (cpfNumeros.length !== 11) {

        alert("Informe um CPF válido com 11 números.");

        cpf.focus();

        return false;

    }


    if (!obraValor) {

        alert("Informe a obra / projeto.");

        obra.focus();

        return false;

    }


    return true;

}


/* =========================================================
   ADICIONAR ARQUIVOS
   ========================================================= */

function adicionarArquivos(fileList) {

    if (!fileList || !fileList.length) {
        return;
    }


    const arquivos = Array.from(fileList);


    arquivos.forEach(file => {

        /*
           Aceita imagens
        */

        if (
            !file.type.startsWith("image/") &&
            !/\.(heic|heif)$/i.test(file.name)
        ) {

            alert(
                `O arquivo "${file.name}" não parece ser uma imagem.`
            );

            return;

        }


        const preview =
            URL.createObjectURL(file);


        receipts.push({

            file: file,

            preview: preview,

            date: dataInputHoje(),

            account: "",

            description: "",

            document: "",

            category: "",

            value: 0

        });

    });


    renderizarCupons();

}


/* =========================================================
   RENDERIZAR CUPONS
   ========================================================= */

function renderizarCupons() {

    list.innerHTML = "";


    receipts.forEach((receipt, index) => {

        const item =
            document.createElement("div");

        item.className = "coupon";


        /*
           Miniatura
        */

        const img =
            document.createElement("img");

        img.src = receipt.preview;

        img.alt = `Cupom ${index + 1}`;


        /*
           Informações
        */

        const info =
            document.createElement("div");

        info.className = "coupon-info";


        const title =
            document.createElement("strong");


        if (receipt.description) {

            title.textContent =
                receipt.description;

        } else {

            title.textContent =
                `Cupom ${index + 1}`;

        }


        const details =
            document.createElement("span");


        const status =
            receipt.document &&
            receipt.category
                ? "✓ Pronto para revisão"
                : "⚠ Precisa conferir";


        details.textContent = status;


        info.appendChild(title);

        info.appendChild(details);


        /*
           Valor
        */

        const value =
            document.createElement("div");

        value.className = "coupon-value";

        value.textContent =
            formatarMoeda(receipt.value);


        /*
           Botões
        */

        const actions =
            document.createElement("div");

        actions.className = "coupon-actions";


        const edit =
            document.createElement("button");

        edit.type = "button";

        edit.title = "Editar cupom";

        edit.textContent = "✏️";

        edit.addEventListener(
            "click",
            () => abrirModal(index)
        );


        const remove =
            document.createElement("button");

        remove.type = "button";

        remove.title = "Excluir cupom";

        remove.textContent = "🗑️";

        remove.addEventListener(
            "click",
            () => excluirCupom(index)
        );


        actions.appendChild(edit);

        actions.appendChild(remove);


        item.appendChild(img);

        item.appendChild(info);

        item.appendChild(value);

        item.appendChild(actions);


        list.appendChild(item);

    });


    atualizarTotais();

}


/* =========================================================
   TOTAIS
   ========================================================= */

function atualizarTotais() {

    count.textContent =
        receipts.length;


    const total =
        receipts.reduce(
            (acc, item) => {

                return acc +
                    numero(item.value);

            },
            0
        );


    sum.textContent =
        formatarMoeda(total);

}


/* =========================================================
   FORMATAR MOEDA
   ========================================================= */

function numero(valor) {

    if (typeof valor === "number") {

        return isNaN(valor)
            ? 0
            : valor;

    }


    if (!valor) {
        return 0;
    }


    let texto =
        String(valor)
            .replace("R$", "")
            .trim();


    if (texto.includes(",")) {

        texto =
            texto
                .replace(/\./g, "")
                .replace(",", ".");

    }


    const resultado =
        parseFloat(texto);


    return isNaN(resultado)
        ? 0
        : resultado;

}


function formatarMoeda(valor) {

    return numero(valor)
        .toLocaleString(
            "pt-BR",
            {
                style: "currency",
                currency: "BRL"
            }
        );

}


/* =========================================================
   MODAL
   ========================================================= */

function abrirModal(index) {

    currentEditIndex = index;


    const receipt =
        receipts[index];


    document.getElementById("mdate").value =
        receipt.date || "";


    document.getElementById("mcat").value =
        receipt.category || "";


    document.getElementById("mdesc").value =
        receipt.description || "";


    document.getElementById("mdoc").value =
        receipt.document || "";


    document.getElementById("mvalue").value =
        receipt.value
            ? String(receipt.value).replace(".", ",")
            : "";


    const photo =
        document.getElementById("photo");


    photo.innerHTML = "";


    /*
       Tentativa de mostrar a imagem
    */

    if (receipt.preview) {

        const img =
            document.createElement("img");

        img.src =
            receipt.preview;

        img.alt =
            "Pré-visualização do cupom";

        photo.appendChild(img);

    }


    document
        .getElementById("modal")
        .classList.add("open");

}


function fecharModal() {

    currentEditIndex = null;


    document
        .getElementById("modal")
        .classList.remove("open");

}


/* =========================================================
   SALVAR CUPOM
   ========================================================= */

function salvarCupom() {

    if (currentEditIndex === null) {
        return;
    }


    const date =
        document.getElementById("mdate").value;


    const category =
        document.getElementById("mcat").value;


    const description =
        document.getElementById("mdesc").value.trim();


    const documentNumber =
        document.getElementById("mdoc").value.trim();


    const value =
        numero(
            document.getElementById("mvalue").value
        );


    /*
       Documento obrigatório
    */

    if (!documentNumber) {

        alert(
            "Informe o número do documento do cupom."
        );

        document
            .getElementById("mdoc")
            .focus();

        return;

    }


    /*
       Categoria obrigatória
    */

    if (!category) {

        alert(
            "Selecione a categoria do cupom."
        );

        document
            .getElementById("mcat")
            .focus();

        return;

    }


    receipts[currentEditIndex].date =
        date;


    receipts[currentEditIndex].category =
        category;


    receipts[currentEditIndex].description =
        description;


    receipts[currentEditIndex].document =
        documentNumber;


    receipts[currentEditIndex].value =
        value;


    fecharModal();

    renderizarCupons();

}


/* =========================================================
   EXCLUIR CUPOM
   ========================================================= */

function excluirCupom(index) {

    const confirmar =
        confirm(
            `Excluir o cupom ${index + 1}?`
        );


    if (!confirmar) {
        return;
    }


    if (receipts[index].preview) {

        URL.revokeObjectURL(
            receipts[index].preview
        );

    }


    receipts.splice(index, 1);


    renderizarCupons();

}


/* =========================================================
   VALIDAÇÃO DOS CUPONS
   ========================================================= */

function validarCupons() {

    if (receipts.length === 0) {

        alert(
            "Adicione pelo menos um cupom."
        );

        return false;

    }


    for (
        let i = 0;
        i < receipts.length;
        i++
    ) {

        const receipt =
            receipts[i];


        if (!receipt.document) {

            alert(
                `O cupom ${i + 1} está sem número do documento.`
            );


            abrirModal(i);

            return false;

        }


        if (!receipt.category) {

            alert(
                `O cupom ${i + 1} está sem categoria.`
            );


            abrirModal(i);

            return false;

        }

    }


    return true;

}


/* =========================================================
   REVISÃO
   ========================================================= */

function montarRevisao() {

    const total =
        receipts.reduce(
            (acc, item) =>
                acc + numero(item.value),
            0
        );


    let html = "";


    /*
       Dados do responsável
    */

    html += `

        <div class="review-section">

            <h3>Dados do responsável</h3>

            <div>

                <div class="review-item">
                    <small>Nome</small>
                    <strong>${escapeHtml(nome.value)}</strong>
                </div>

                <div class="review-item">
                    <small>CPF</small>
                    <strong>${escapeHtml(cpf.value)}</strong>
                </div>

                <div class="review-item">
                    <small>Departamento</small>
                    <strong>Projetos</strong>
                </div>

                <div class="review-item">
                    <small>Obra</small>
                    <strong>${escapeHtml(obra.value)}</strong>
                </div>

                <div class="review-item">
                    <small>Período</small>
                    <strong>${escapeHtml(periodo.value)}</strong>
                </div>

                <div class="review-item">
                    <small>Cargo</small>
                    <strong>Prestador de Serviços</strong>
                </div>

                <div class="review-item">
                    <small>Gerente</small>
                    <strong>Roberto Almeida Blanco</strong>
                </div>

            </div>

        </div>

    `;


    /*
       Cupons
    */

    html += `

        <div class="review-section">

            <h3>
                Cupons (${receipts.length})
            </h3>

            <div>
    `;


    receipts.forEach((receipt, index) => {

        html += `

            <div class="review-item">

                <small>
                    Cupom ${index + 1}
                </small>

                <strong>
                    ${escapeHtml(
                        receipt.description ||
                        "Sem descrição"
                    )}
                </strong>

                <small>
                    Documento:
                    ${escapeHtml(
                        receipt.document
                    )}
                </small>

                <small>
                    Categoria:
                    ${escapeHtml(
                        receipt.category
                    )}
                </small>

                <strong>
                    ${formatarMoeda(receipt.value)}
                </strong>

            </div>

        `;

    });


    html += `

            </div>

        </div>


        <div class="review-section">

            <h3>Total do RDD</h3>

            <div>

                <div class="review-item">

                    <small>
                        Quantidade de cupons
                    </small>

                    <strong>
                        ${receipts.length}
                    </strong>

                </div>

                <div class="review-item">

                    <small>
                        Valor total
                    </small>

                    <strong>
                        ${formatarMoeda(total)}
                    </strong>

                </div>

            </div>

        </div>

    `;


    review.innerHTML = html;

}


/* =========================================================
   GERAR RDD
   ========================================================= */

async function gerarRDD() {

    /*
       Valida novamente
    */

    if (!validarDados()) {

        mostrarTela("dados");

        return;

    }


    if (!validarCupons()) {

        mostrarTela("cupons");

        return;

    }


    const botao =
        document.getElementById("generate");


    const textoOriginal =
        botao.innerHTML;


    botao.disabled = true;

    botao.innerHTML =
        "⏳ GERANDO RDD...";


    try {

        /*
           Payload
        */

        const payload = {

            nome:
                nome.value.trim(),

            cpf:
                cpf.value.trim(),

            obra:
                obra.value.trim(),

            receipts:
                receipts.map(receipt => ({

                    date:
                        receipt.date,

                    account:
                        receipt.account || "",

                    description:
                        receipt.description || "",

                    document:
                        receipt.document || "",

                    category:
                        receipt.category,

                    value:
                        numero(receipt.value)

                }))

        };


        /*
           FormData
        */

        const formData =
            new FormData();


        formData.append(
            "payload",
            JSON.stringify(payload)
        );


        /*
           Adiciona as imagens
        */

        receipts.forEach(receipt => {

            formData.append(
                "receipts",
                receipt.file,
                receipt.file.name
            );

        });


        /*
           Chama Render
        */

        const response =
            await fetch(
                `${API_URL}/api/generate`,
                {
                    method: "POST",
                    body: formData
                }
            );


        /*
           Erro da API
        */

        if (!response.ok) {

            let mensagem =
                "Não foi possível gerar o RDD.";


            try {

                const erro =
                    await response.json();


                if (erro.detail) {

                    mensagem =
                        erro.detail;

                }

            } catch (_) {

                // Mantém mensagem padrão

            }


            throw new Error(mensagem);

        }


        /*
           Recebe PDF
        */

        const blob =
            await response.blob();


        /*
           Cria link temporário
        */

        const url =
            URL.createObjectURL(blob);


        const link =
            document.createElement("a");


        link.href = url;

        link.download =
            "RDD-Parceiro.pdf";


        document.body.appendChild(link);

        link.click();

        link.remove();


        URL.revokeObjectURL(url);


        /*
           Finalização
        */

        message.textContent =
            "O RDD foi gerado com sucesso. O PDF foi baixado para o seu dispositivo.";


        mostrarTela("final");


    } catch (error) {

        console.error(error);


        alert(
            "Erro ao gerar o RDD:\n\n" +
            error.message
        );


    } finally {

        botao.disabled = false;

        botao.innerHTML =
            textoOriginal;

    }

}


/* =========================================================
   NAVEGAÇÃO ENTRE TELAS
   ========================================================= */

function mostrarTela(id) {

    const telas =
        document.querySelectorAll(".screen");


    telas.forEach(tela => {

        tela.classList.remove("on");

    });


    const tela =
        document.getElementById(id);


    if (tela) {

        tela.classList.add("on");

    }


    atualizarEtapas(id);


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


/* =========================================================
   ETAPAS
   ========================================================= */

function atualizarEtapas(id) {

    const ordem = [
        "dados",
        "cupons",
        "revisao",
        "final"
    ];


    const indice =
        ordem.indexOf(id);


    const steps =
        document.querySelectorAll(".step");


    steps.forEach((step, i) => {

        step.classList.toggle(
            "active",
            i === indice
        );

    });

}


/* =========================================================
   INTERFACE INICIAL
   ========================================================= */

function atualizarInterface() {

    atualizarTotais();

    atualizarEtapas("dados");

}


/* =========================================================
   NOVO RDD
   ========================================================= */

function novoRDD() {

    /*
       Libera previews antigos
    */

    receipts.forEach(receipt => {

        if (receipt.preview) {

            URL.revokeObjectURL(
                receipt.preview
            );

        }

    });


    receipts = [];

    currentEditIndex = null;


    nome.value = "";

    cpf.value = "";

    obra.value = "";


    definirPeriodo();


    renderizarCupons();


    review.innerHTML = "";


    mostrarTela("dados");

}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHtml(value) {

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}
```
