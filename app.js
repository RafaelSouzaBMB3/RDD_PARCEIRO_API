const API_URL = "https://rdd-parceiro-api-1.onrender.com";


// ============================================================
// ESTADO GLOBAL ÚNICO
// ============================================================

if (!window.RDD_PARCEIRO_STATE) {

    window.RDD_PARCEIRO_STATE = {

        cupons: [],

        ocrWorker: null,

        processamentoEmAndamento: false,

        modalCupomIndex: null,

        modoModal: null,

        inicializado: false

    };

}


const STATE = window.RDD_PARCEIRO_STATE;


// ============================================================
// INICIALIZAÇÃO
// ============================================================

document.addEventListener("DOMContentLoaded", function () {

    if (STATE.inicializado) {

        console.log(
            "RDD Parceiro: inicialização duplicada ignorada."
        );

        return;

    }

    STATE.inicializado = true;


    console.log(
        "RDD PARCEIRO BMB3 iniciado."
    );


    // --------------------------------------------------------
    // ELEMENTOS
    // --------------------------------------------------------

    const nome =
        document.getElementById("nome");

    const cpf =
        document.getElementById("cpf");

    const obra =
        document.getElementById("obra");

    const periodo =
        document.getElementById("periodo");

    const next1 =
        document.getElementById("next1");

    const back1 =
        document.getElementById("back1");

    const next2 =
        document.getElementById("next2");

    const back2 =
        document.getElementById("back2");

    const generate =
        document.getElementById("generate");

    const novo =
        document.getElementById("new");

    const filesInput =
        document.getElementById("files");


    // ========================================================
    // PERÍODO AUTOMÁTICO
    // ========================================================

    if (periodo) {

        const hoje = new Date();

        const primeiroDia =
            new Date(
                hoje.getFullYear(),
                hoje.getMonth(),
                1
            );

        const ultimoDia =
            new Date(
                hoje.getFullYear(),
                hoje.getMonth() + 1,
                0
            );

        periodo.value =
            primeiroDia.toLocaleDateString("pt-BR") +
            " até " +
            ultimoDia.toLocaleDateString("pt-BR");

    }


    // ========================================================
    // TELAS
    // ========================================================

    const telas = {

        1: document.getElementById("dados"),

        2: document.getElementById("cupons"),

        3: document.getElementById("revisao"),

        4: document.getElementById("final")

    };


    const etapas =
        document.querySelectorAll(
            ".progress .step"
        );


    function mostrarTela(numero) {

        Object.values(telas)
            .forEach(function (tela) {

                if (!tela) return;

                tela.classList.remove("on");

                tela.classList.remove("active");

                tela.style.display = "none";

            });


        const telaAtual =
            telas[numero];


        if (telaAtual) {

            telaAtual.classList.add("on");

            telaAtual.classList.add("active");

            telaAtual.style.display = "block";

        }


        etapas.forEach(
            function (etapa, index) {

                const numeroEtapa =
                    index + 1;

                etapa.classList.remove(
                    "active"
                );

                etapa.classList.remove(
                    "done"
                );


                if (
                    numeroEtapa < numero
                ) {

                    etapa.classList.add(
                        "done"
                    );

                }


                if (
                    numeroEtapa === numero
                ) {

                    etapa.classList.add(
                        "active"
                    );

                }

            }
        );


        window.scrollTo({

            top: 0,

            behavior: "smooth"

        });

    }


    window.RDDMostrarTela =
        mostrarTela;


    // ========================================================
    // ETAPA 1 → ETAPA 2
    // ========================================================

    if (next1) {

        next1.type = "button";


        next1.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                event.stopImmediatePropagation();


                if (
                    !nome ||
                    !nome.value.trim()
                ) {

                    alert(
                        "Informe o nome completo."
                    );

                    if (nome) {
                        nome.focus();
                    }

                    return;

                }


                const cpfNumeros =
                    cpf
                        ? cpf.value.replace(
                            /\D/g,
                            ""
                        )
                        : "";


                if (
                    cpfNumeros.length !== 11
                ) {

                    alert(
                        "Informe um CPF válido com 11 números."
                    );

                    if (cpf) {
                        cpf.focus();
                    }

                    return;

                }


                if (
                    !obra ||
                    !obra.value.trim()
                ) {

                    alert(
                        "Informe a obra / projeto."
                    );

                    if (obra) {
                        obra.focus();
                    }

                    return;

                }


                mostrarTela(2);

            },
            true
        );

    }


    // ========================================================
    // VOLTAR → DADOS
    // ========================================================

    if (back1) {

        back1.type = "button";


        back1.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                event.stopImmediatePropagation();

                mostrarTela(1);

            },
            true
        );

    }


    // ========================================================
    // ETAPA 2 → ETAPA 3
    // ========================================================

    if (next2) {

        next2.type = "button";


        next2.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                event.stopImmediatePropagation();


                console.log(
                    "CONTINUAR pressionado."
                );


                console.log(
                    "Cupons no estado:",
                    STATE.cupons.length
                );


                console.log(
                    "Cupons na tela:",
                    document.querySelectorAll(
                        "#list .coupon-card"
                    ).length
                );


                if (
                    !STATE.cupons ||
                    STATE.cupons.length === 0
                ) {

                    const cards =
                        document.querySelectorAll(
                            "#list .coupon-card"
                        );


                    if (
                        cards.length === 0
                    ) {

                        alert(
                            "Adicione pelo menos um cupom antes de continuar."
                        );

                        return;

                    }

                }


                const incompletos =
                    STATE.cupons.filter(
                        function (cupom) {

                            return (
                                !cupom.document ||
                                !cupom.category ||
                                !cupom.description
                            );

                        }
                    );


                if (
                    incompletos.length > 0
                ) {

                    alert(
                        "Existem cupons que precisam ser revisados. " +
                        "Informe o número do documento e o nome do estabelecimento."
                    );

                    return;

                }


                atualizarRevisao();

                mostrarTela(3);

            },
            true
        );

    }


    // ========================================================
    // VOLTAR → CUPONS
    // ========================================================

    if (back2) {

        back2.type = "button";


        back2.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                event.stopImmediatePropagation();

                mostrarTela(2);

            },
            true
        );

    }


    // ========================================================
    // GERAR
    // ========================================================

    if (generate) {

        generate.type = "button";


        generate.addEventListener(
            "click",
            async function (event) {

                event.preventDefault();

                event.stopImmediatePropagation();

                await gerarRDD();

            },
            true
        );

    }


    // ========================================================
    // NOVO RDD
    // ========================================================

    if (novo) {

        novo.type = "button";


        novo.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                event.stopImmediatePropagation();


                STATE.cupons = [];


                if (filesInput) {

                    filesInput.value = "";

                }


                renderizarCupons();

                

            if (window.RDD_PROCESSAMENTO) {
                window.RDD_PROCESSAMENTO.atualizar(
                    "✅ Comprovante processado",
                    "Os dados foram carregados e o cupom está disponível para conferência.",
                    arquivos.length,
                    i + 1
                );
            }

mostrarTela(1);

            },
            true
        );

    }


    // ========================================================
    // ARQUIVOS
    // ========================================================

    if (filesInput) {

        filesInput.addEventListener(
            "change",
            async function () {

                if (
                    !filesInput.files ||
                    !filesInput.files.length
                ) {

                    return;

                }


                console.log(
                    "Arquivos recebidos:",
                    filesInput.files.length
                );


                await processarArquivos(
                    Array.from(
                        filesInput.files
                    )
                );

            }
        );

    }


    // ========================================================
    // CATEGORIA
    // ========================================================

    const mcat =
        document.getElementById("mcat");


    if (mcat) {

        mcat.value =
            "Materiais";

    }


    // ========================================================
    // MODAL
    // ========================================================

    configurarModal();


    // ========================================================
    // TELA INICIAL
    // ========================================================

    mostrarTela(1);

});


// ============================================================
// CARREGAR TESSERACT
// ============================================================

async function carregarTesseract() {

    if (window.Tesseract) {

        return;

    }


    await carregarScript(
        "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"
    );

}


// ============================================================
// CARREGAR HEIC
// ============================================================

async function carregarHeic2Any() {

    if (window.heic2any) {

        return;

    }


    await carregarScript(
        "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js"
    );

}


// ============================================================
// CARREGAR SCRIPT
// ============================================================

function carregarScript(src) {

    return new Promise(
        function (resolve, reject) {

            const script =
                document.createElement(
                    "script"
                );


            script.src = src;


            script.onload =
                resolve;


            script.onerror =
                function () {

                    reject(
                        new Error(
                            "Não foi possível carregar: " +
                            src
                        )
                    );

                };


            document.head.appendChild(
                script
            );

        }
    );

}


// ============================================================
// PROCESSAR ARQUIVOS
// ============================================================

async function processarArquivos(
    arquivos
) {

    if (
        STATE.processamentoEmAndamento
    ) {

        return;

    }


    STATE.processamentoEmAndamento =
        true;


    

    /* TELA REAL DE PROCESSAMENTO */
    if (window.RDD_PROCESSAMENTO) {
        window.RDD_PROCESSAMENTO.mostrar(
            arquivos.length,
            1
        );
    }

const status =
        document.getElementById(
            "uploadStatus"
        );


    const statusTitle =
        document.getElementById(
            "uploadStatusTitle"
        );


    const statusText =
        document.getElementById(
            "uploadStatusText"
        );


    if (status) {

        status.classList.add("show");

    }


    if (statusTitle) {

        statusTitle.textContent =
            "🔎 Lendo os comprovantes...";

    }


    if (statusText) {

        statusText.textContent =
            "Aguarde enquanto o sistema identifica os dados dos cupons.";

    }


    try {

        await carregarTesseract();


        for (
            let i = 0;
            i < arquivos.length;
            i++
        ) {

            const arquivo =
                arquivos[i];


            const existe =
                STATE.cupons.some(
                    function (cupom) {

                        return (
                            cupom.originalName ===
                            arquivo.name
                        );

                    }
                );


            if (existe) {

                continue;

            }


            if (statusText) {

                statusText.textContent =
                    "Processando cupom " +
                    (i + 1) +
                    " de " +
                    arquivos.length +
                    "...";

            }

            if (window.RDD_PROCESSAMENTO) {
                window.RDD_PROCESSAMENTO.atualizar(
                    "🔎 Lendo comprovante...",
                    "O sistema está identificando data, estabelecimento, documento e valor.",
                    arquivos.length,
                    i + 1
                );
            }

            if (window.RDD_PROCESSAMENTO) {
                window.RDD_PROCESSAMENTO.atualizar(
                    "⚙️ Processando imagem...",
                    "Convertendo e preparando o comprovante para leitura.",
                    arquivos.length,
                    i + 1
                );
            }




            const cupom =
                await processarCupom(
                    arquivo,
                    STATE.cupons.length + 1
                );


            STATE.cupons.push(
                cupom
            );


            renderizarCupons();

        }


        if (statusTitle) {

            statusTitle.textContent =
                "✅ Comprovantes processados";

        }


        if (statusText) {

            statusText.textContent =
                STATE.cupons.length +
                " cupom(ns) carregado(s). Confira os dados abaixo.";

        }


    } catch (erro) {

        console.error(
            "Erro no processamento:",
            erro
        );


        if (statusTitle) {

            statusTitle.textContent =
                "⚠️ Atenção";

        }


        if (statusText) {

            statusText.textContent =
                "Não foi possível processar todos os comprovantes. " +
                "Você poderá revisar manualmente.";

        }

    }


    STATE.processamentoEmAndamento =
        false;


    atualizarResumo();



    if (window.RDD_PROCESSAMENTO) {
        window.RDD_PROCESSAMENTO.finalizar();
    }

}


// ============================================================
// PROCESSAR CUPOM
// ============================================================

async function processarCupom(
    arquivo,
    numero
) {

    let imagemOCR =
        arquivo;


    const extensao =
        arquivo.name
            .split(".")
            .pop()
            .toLowerCase();


    // --------------------------------------------------------
    // HEIC / HEIF
    // --------------------------------------------------------

    if (
        extensao === "heic" ||
        extensao === "heif" ||
        arquivo.type === "image/heic" ||
        arquivo.type === "image/heif"
    ) {

        try {

            await carregarHeic2Any();


            const convertido =
                await window.heic2any({

                    blob:
                        arquivo,

                    toType:
                        "image/jpeg",

                    quality:
                        0.9

                });


            imagemOCR =
                Array.isArray(
                    convertido
                )
                    ? convertido[0]
                    : convertido;


        } catch (erro) {

            console.warn(
                "Falha na conversão HEIC:",
                erro
            );

        }

    }


    const previewURL =
        URL.createObjectURL(
            imagemOCR
        );


    let textoOCR = "";


    // --------------------------------------------------------
    // OCR
    // --------------------------------------------------------

    try {

        if (!STATE.ocrWorker) {

            STATE.ocrWorker =
                await Tesseract.createWorker(
                    "por"
                );

        }


        const resultado =
            await STATE.ocrWorker.recognize(
                previewURL
            );


        textoOCR =
            resultado.data.text ||
            "";


    } catch (erro) {

        console.error(
            "Erro OCR:",
            erro
        );

    }


    // --------------------------------------------------------
    // INTERPRETAÇÃO
    // --------------------------------------------------------

    const dados =
        interpretarCupom(
            textoOCR
        );


    // --------------------------------------------------------
    // CATEGORIA SEMPRE MATERIAIS
    // --------------------------------------------------------

    return {

        id:
            Date.now() +
            Math.random(),

        numero:
            numero,

        file:
            arquivo,

        originalName:
            arquivo.name,

        previewURL:
            previewURL,

        ocrText:
            textoOCR,

        date:
            dados.date ||
            "",

        // O nome do estabelecimento NUNCA vem preenchido do OCR:
        // a pessoa que está preenchendo é obrigada a digitar.
        description:
            "",

        document:
            dados.document ||
            "",

        category:
            "Materiais",

        value:
            dados.value ||
            "",

        status:
            (
                dados.date &&
                dados.description &&
                dados.document &&
                dados.value
            )
                ? "ok"
                : "revisao"

    };

}


// ============================================================
// INTERPRETAR OCR
// ============================================================

function interpretarCupom(
    texto
) {

    const resultado = {

        date: "",

        description: "",

        document: "",

        value: "",

        category:
            "Materiais"

    };


    if (!texto) {

        return resultado;

    }


    const linhas =
        texto
            .split(/\r?\n/)
            .map(
                function (linha) {

                    return linha.trim();

                }
            )
            .filter(Boolean);


    // --------------------------------------------------------
    // DATA
    // --------------------------------------------------------

    const regexData =
        /\b(0?[1-9]|[12]\d|3[01])[\/\-](0?[1-9]|1[0-2])[\/\-](20\d{2}|\d{2})\b/;


    for (
        const linha of linhas
    ) {

        const encontrado =
            linha.match(
                regexData
            );


        if (encontrado) {

            let data =
                encontrado[0]
                    .replace(
                        /-/g,
                        "/"
                    );


            const partes =
                data.split("/");


            if (
                partes[2].length === 2
            ) {

                partes[2] =
                    "20" +
                    partes[2];

            }


            resultado.date =
                partes[2] +
                "-" +
                String(
                    partes[1]
                ).padStart(
                    2,
                    "0"
                ) +
                "-" +
                String(
                    partes[0]
                ).padStart(
                    2,
                    "0"
                );


            break;

        }

    }


    // --------------------------------------------------------
    // VALORES
    // --------------------------------------------------------

    const regexValor =
        /(?:R\$?\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/g;


    const valores = [];


    let matchValor;


    while (
        (
            matchValor =
                regexValor.exec(
                    texto
                )
        ) !== null
    ) {

        const numero =
            parseFloat(
                matchValor[1]
                    .replace(
                        /\./g,
                        ""
                    )
                    .replace(
                        ",",
                        "."
                    )
            );


        if (
            !isNaN(numero)
        ) {

            valores.push(
                numero
            );

        }

    }


    if (valores.length) {

        const maior =
            Math.max(
                ...valores
            );


        resultado.value =
            maior
                .toFixed(2)
                .replace(
                    ".",
                    ","
                );

    }


    // --------------------------------------------------------
    // DOCUMENTO
    // --------------------------------------------------------

    const padroesDocumento = [

        /NFC[- ]?e[^0-9]{0,20}(\d{4,20})/i,

        /NFC[^0-9]{0,20}(\d{4,20})/i,

        /COO[^0-9]{0,20}(\d{4,20})/i,

        /CUPOM[^0-9]{0,20}(\d{4,20})/i,

        /DOCUMENTO[^0-9]{0,20}(\d{4,20})/i,

        /N[º°.]?\s*[:\-]?\s*(\d{4,20})/i

    ];


    for (
        const regex of padroesDocumento
    ) {

        const encontrado =
            texto.match(
                regex
            );


        if (encontrado) {

            resultado.document =
                encontrado[1];

            break;

        }

    }


    // --------------------------------------------------------
    // ESTABELECIMENTO
    // --------------------------------------------------------

    const palavrasIgnorar = [

        "CNPJ",

        "CPF",

        "NFC",

        "NFCE",

        "CUPOM",

        "DOCUMENTO",

        "DATA",

        "VALOR",

        "TOTAL",

        "R$",

        "EMISSAO",

        "EMISSÃO",

        "CONSUMIDOR",

        "ENDERECO",

        "ENDEREÇO",

        "CHAVE",

        "PROTOCOLO",

        "ITEM",

        "QTD",

        "QUANTIDADE",

        "UN",

        "VALOR UNITARIO",

        "VALOR UNITÁRIO"

    ];


    for (
        const linha of linhas
    ) {

        const limpa =
            linha
                .replace(
                    /[^\p{L}\p{N}\s&.'-]/gu,
                    " "
                )
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();


        if (
            limpa.length < 3 ||
            limpa.length > 70
        ) {

            continue;

        }


        const maiuscula =
            limpa.toUpperCase();


        if (
            palavrasIgnorar.some(
                function (palavra) {

                    return maiuscula
                        .startsWith(
                            palavra
                        );

                }
            )
        ) {

            continue;

        }


        if (
            /\d{2,}/.test(limpa) &&
            !/[A-Za-zÀ-ÿ]{4,}/.test(limpa)
        ) {

            continue;

        }


        resultado.description =
            limpa;

        break;

    }


    return resultado;

}


// ============================================================
// RENDERIZAR CUPONS
// ============================================================

function renderizarCupons() {

    const lista =
        document.getElementById(
            "list"
        );


    if (!lista) {

        return;

    }


    lista.innerHTML = "";


    STATE.cupons.forEach(
        function (cupom, index) {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "coupon-card";


            const statusOK =
                cupom.status ===
                "ok";


            const statusHTML =
                statusOK

                    ? `
                        <span style="
                            color:#0b6b45;
                            font-weight:bold;
                        ">
                            ✓ Dados identificados
                        </span>
                    `

                    : `
                        <span style="
                            color:#b42318;
                            font-weight:bold;
                        ">
                            ⚠️ Revisão necessária
                        </span>
                    `;


            const valor =
                cupom.value
                    ? "R$ " +
                      cupom.value
                    : "Não identificado";


            card.innerHTML = `

                <div style="
                    display:flex;
                    gap:15px;
                    align-items:flex-start;
                ">

                    <img
                        src="${cupom.previewURL}"
                        alt="Cupom ${index + 1}"
                        style="
                            width:90px;
                            height:110px;
                            object-fit:cover;
                            border-radius:10px;
                            border:1px solid #ddd;
                            cursor:pointer;
                        "
                        data-zoom="${index}"
                    >

                    <div style="
                        flex:1;
                        min-width:0;
                    ">

                        <div style="
                            display:flex;
                            justify-content:space-between;
                            gap:10px;
                            align-items:center;
                            margin-bottom:8px;
                        ">

                            <strong>
                                🧾 Cupom ${index + 1}
                            </strong>

                            ${statusHTML}

                        </div>


                        <div style="
                            font-size:13px;
                            line-height:1.7;
                        ">

                            <div>
                                <strong>Data:</strong>
                                ${formatarDataExibicao(
                                    cupom.date
                                )}
                            </div>


                            <div>
                                <strong>
                                    Estabelecimento:
                                </strong>

                                ${escapeHTML(
                                    cupom.description ||
                                    "Não identificado"
                                )}
                            </div>


                            <div>
                                <strong>
                                    Documento:
                                </strong>

                                ${escapeHTML(
                                    cupom.document ||
                                    "Não identificado"
                                )}
                            </div>


                            <div>
                                <strong>
                                    Categoria:
                                </strong>

                                <span style="
                                    font-weight:bold;
                                    color:#071b33;
                                ">
                                    MATERIAIS
                                </span>
                            </div>


                            <div>
                                <strong>
                                    Valor:
                                </strong>

                                ${escapeHTML(
                                    valor
                                )}
                            </div>

                        </div>


                        <div style="
                            display:flex;
                            gap:8px;
                            flex-wrap:wrap;
                            margin-top:12px;
                        ">

                            <button
                                type="button"
                                class="btn btn-secondary"
                                data-zoom="${index}"
                                style="
                                    min-height:38px;
                                    padding:0 12px;
                                "
                            >
                                🔍 Ver cupom
                            </button>


                            <button
                                type="button"
                                class="btn btn-primary"
                                data-edit="${index}"
                                style="
                                    min-height:38px;
                                    padding:0 12px;
                                "
                            >
                                ✏️ Editar
                            </button>

                        </div>

                    </div>

                </div>

            `;


            lista.appendChild(
                card
            );

        }
    );


    // --------------------------------------------------------
    // BOTÃO EDITAR
    // --------------------------------------------------------

    lista
        .querySelectorAll(
            "[data-edit]"
        )
        .forEach(
            function (botao) {

                botao.addEventListener(
                    "click",
                    function () {

                        const index =
                            Number(
                                botao.dataset.edit
                            );


                        abrirEdicao(
                            index
                        );

                    }
                );

            }
        );


    // --------------------------------------------------------
    // BOTÃO VER
    // --------------------------------------------------------

    lista
        .querySelectorAll(
            "[data-zoom]"
        )
        .forEach(
            function (elemento) {

                elemento.addEventListener(
                    "click",
                    function () {

                        const index =
                            Number(
                                elemento.dataset.zoom
                            );


                        abrirVisualizacao(
                            index
                        );

                    }
                );

            }
        );


    atualizarResumo();

}


// ============================================================
// RESUMO
// ============================================================

function atualizarResumo() {

    const count =
        document.getElementById(
            "count"
        );


    const sum =
        document.getElementById(
            "sum"
        );


    if (count) {

        count.textContent =
            STATE.cupons.length;

    }


    let total = 0;


    STATE.cupons.forEach(
        function (cupom) {

            const valor =
                converterValor(
                    cupom.value
                );


            if (!isNaN(valor)) {

                total += valor;

            }

        }
    );


    if (sum) {

        sum.textContent =
            formatarMoeda(
                total
            );

    }

}


// ============================================================
// REVISÃO
// ============================================================

function atualizarRevisao() {

    const nome =
        document.getElementById(
            "nome"
        );


    const cpf =
        document.getElementById(
            "cpf"
        );


    const obra =
        document.getElementById(
            "obra"
        );


    const count =
        document.getElementById(
            "reviewCount"
        );


    const total =
        document.getElementById(
            "reviewTotal"
        );


    const reviewNome =
        document.getElementById(
            "reviewNome"
        );


    const reviewCpf =
        document.getElementById(
            "reviewCpf"
        );


    const reviewObra =
        document.getElementById(
            "reviewObra"
        );


    if (reviewNome) {

        reviewNome.textContent =
            nome
                ? nome.value
                : "";

    }


    if (reviewCpf) {

        reviewCpf.textContent =
            cpf
                ? cpf.value
                : "";

    }


    if (reviewObra) {

        reviewObra.textContent =
            obra
                ? obra.value
                : "";

    }


    if (count) {

        count.textContent =
            STATE.cupons.length;

    }


    if (total) {

        let valorTotal = 0;


        STATE.cupons.forEach(
            function (cupom) {

                valorTotal +=
                    converterValor(
                        cupom.value
                    ) || 0;

            }
        );


        total.textContent =
            formatarMoeda(
                valorTotal
            );

    }

}


// ============================================================
// CONFIGURAR MODAL
// ============================================================

function configurarModal() {

    const close =
        document.getElementById(
            "close"
        );


    const closeModal =
        document.getElementById(
            "closeModal"
        );


    const save =
        document.getElementById(
            "save"
        );


    const modal =
        document.getElementById(
            "modal"
        );


    if (close) {

        close.addEventListener(
            "click",
            fecharModal
        );

    }


    if (closeModal) {

        closeModal.addEventListener(
            "click",
            fecharModal
        );

    }


    if (modal) {

        modal.addEventListener(
            "click",
            function (event) {

                if (
                    event.target === modal
                ) {

                    fecharModal();

                }

            }
        );

    }


    if (save) {

        save.addEventListener(
            "click",
            salvarEdicao
        );

    }

}


// ============================================================
// EDITAR CUPOM
// ============================================================

function abrirEdicao(index) {

    const cupom =
        STATE.cupons[index];


    if (!cupom) {

        return;

    }


    STATE.modalCupomIndex =
        index;


    STATE.modoModal =
        "editar";


    const modal =
        document.getElementById(
            "modal"
        );


    const photo =
        document.getElementById(
            "photo"
        );


    const mdate =
        document.getElementById(
            "mdate"
        );


    const mcat =
        document.getElementById(
            "mcat"
        );


    const mdesc =
        document.getElementById(
            "mdesc"
        );


    const mdoc =
        document.getElementById(
            "mdoc"
        );


    const mvalue =
        document.getElementById(
            "mvalue"
        );


    // --------------------------------------------------------
    // IMAGEM GRANDE DO CUPOM
    // --------------------------------------------------------

    if (photo) {

        photo.src =
            cupom.previewURL;


        photo.style.display =
            "block";


        photo.style.maxWidth =
            "100%";


        photo.style.maxHeight =
            "65vh";


        photo.style.objectFit =
            "contain";


        photo.style.cursor =
            "zoom-in";

    }


    // --------------------------------------------------------
    // PREENCHER CAMPOS COM OCR
    // --------------------------------------------------------

    if (mdate) {

        mdate.value =
            cupom.date || "";

    }


    if (mcat) {

        mcat.value =
            "Materiais";

        mcat.disabled =
            true;

    }


    if (mdesc) {

        mdesc.value =
            cupom.description || "";

    }


    if (mdoc) {

        mdoc.value =
            cupom.document || "";

    }


    if (mvalue) {

        mvalue.value =
            cupom.value || "";

    }


    // --------------------------------------------------------
    // BOTÃO SALVAR
    // --------------------------------------------------------

    const save =
        document.getElementById(
            "save"
        );


    if (save) {

        save.style.display =
            "";

        save.disabled =
            false;

        save.textContent =
            "💾 Salvar alterações";

    }


    // --------------------------------------------------------
    // TÍTULO
    // --------------------------------------------------------

    const titulo =
        document.querySelector(
            "#modal h2, #modal h3, #modal .modal-title"
        );


    if (titulo) {

        titulo.textContent =
            "✏️ Editar cupom";

    }


    // --------------------------------------------------------
    // ABRIR
    // --------------------------------------------------------

    if (modal) {

        modal.classList.add(
            "show"
        );

    }

}


// ============================================================
// VISUALIZAR CUPOM
// ============================================================

function abrirVisualizacao(index) {

    const cupom =
        STATE.cupons[index];


    if (!cupom) {

        return;

    }


    STATE.modalCupomIndex =
        index;


    STATE.modoModal =
        "visualizar";


    const modal =
        document.getElementById(
            "modal"
        );


    const photo =
        document.getElementById(
            "photo"
        );


    const mdate =
        document.getElementById(
            "mdate"
        );


    const mcat =
        document.getElementById(
            "mcat"
        );


    const mdesc =
        document.getElementById(
            "mdesc"
        );


    const mdoc =
        document.getElementById(
            "mdoc"
        );


    const mvalue =
        document.getElementById(
            "mvalue"
        );


    if (photo) {

        photo.src =
            cupom.previewURL;


        photo.style.display =
            "block";


        photo.style.maxWidth =
            "100%";


        photo.style.maxHeight =
            "75vh";


        photo.style.objectFit =
            "contain";


        photo.style.cursor =
            "zoom-in";

    }


    if (mdate) {

        mdate.value =
            cupom.date || "";

        mdate.disabled =
            true;

    }


    if (mcat) {

        mcat.value =
            "Materiais";

        mcat.disabled =
            true;

    }


    if (mdesc) {

        mdesc.value =
            cupom.description || "";

        mdesc.disabled =
            true;

    }


    if (mdoc) {

        mdoc.value =
            cupom.document || "";

        mdoc.disabled =
            true;

    }


    if (mvalue) {

        mvalue.value =
            cupom.value || "";

        mvalue.disabled =
            true;

    }


    const save =
        document.getElementById(
            "save"
        );


    if (save) {

        save.style.display =
            "none";

    }


    const titulo =
        document.querySelector(
            "#modal h2, #modal h3, #modal .modal-title"
        );


    if (titulo) {

        titulo.textContent =
            "🔍 Visualizar cupom";

    }


    if (modal) {

        modal.classList.add(
            "show"
        );

    }

}


// ============================================================
// SALVAR EDIÇÃO
// ============================================================

function salvarEdicao() {

    if (
        STATE.modoModal !==
        "editar"
    ) {

        return;

    }


    const index =
        STATE.modalCupomIndex;


    if (
        index === null ||
        index === undefined
    ) {

        return;

    }


    const cupom =
        STATE.cupons[index];


    if (!cupom) {

        return;

    }


    const mdate =
        document.getElementById(
            "mdate"
        );


    const mdesc =
        document.getElementById(
            "mdesc"
        );


    const mdoc =
        document.getElementById(
            "mdoc"
        );


    const mvalue =
        document.getElementById(
            "mvalue"
        );


    const documento =
        mdoc
            ? mdoc.value.trim()
            : "";


    // --------------------------------------------------------
    // DOCUMENTO É OBRIGATÓRIO
    // --------------------------------------------------------

    if (!documento) {

        alert(
            "Informe o número do documento."
        );


        if (mdoc) {

            mdoc.focus();

        }


        return;

    }


    // ESTABELECIMENTO É OBRIGATÓRIO: o OCR não preenche,
    // então a pessoa precisa digitar o nome.
    const estabelecimento =
        mdesc
            ? mdesc.value.trim()
            : "";


    if (!estabelecimento) {

        alert(
            "Informe o nome do estabelecimento."
        );


        if (mdesc) {

            mdesc.focus();

        }


        return;

    }


    cupom.date =
        mdate
            ? mdate.value
            : "";


    cupom.category =
        "Materiais";


    cupom.description =
        estabelecimento;


    cupom.document =
        documento;


    cupom.value =
        mvalue
            ? mvalue.value.trim()
            : "";


    cupom.status =
        (
            cupom.date &&
            cupom.description &&
            cupom.document &&
            cupom.value
        )
            ? "ok"
            : "revisao";


    fecharModal();


    renderizarCupons();

}


// ============================================================
// FECHAR MODAL
// ============================================================

function fecharModal() {

    const modal =
        document.getElementById(
            "modal"
        );


    if (modal) {

        modal.classList.remove(
            "show"
        );

    }


    // Reabilita os campos para a próxima edição

    const campos = [

        "mdate",

        "mcat",

        "mdesc",

        "mdoc",

        "mvalue"

    ];


    campos.forEach(
        function (id) {

            const campo =
                document.getElementById(
                    id
                );


            if (campo) {

                campo.disabled =
                    false;

            }

        }
    );


    const save =
        document.getElementById(
            "save"
        );


    if (save) {

        save.style.display =
            "";

    }


    STATE.modalCupomIndex =
        null;


    STATE.modoModal =
        null;

}


// ============================================================
// ZOOM NA IMAGEM
// ============================================================

function ativarZoomImagem() {

    const photo =
        document.getElementById(
            "photo"
        );


    if (!photo) {

        return;

    }


    photo.onclick =
        function () {

            if (
                !photo.src
            ) {

                return;

            }


            const overlay =
                document.createElement(
                    "div"
                );


            overlay.style.position =
                "fixed";


            overlay.style.inset =
                "0";


            overlay.style.background =
                "rgba(0,0,0,.92)";


            overlay.style.zIndex =
                "99999";


            overlay.style.display =
                "flex";


            overlay.style.alignItems =
                "center";


            overlay.style.justifyContent =
                "center";


            overlay.style.padding =
                "20px";


            overlay.style.cursor =
                "zoom-out";


            const imagem =
                document.createElement(
                    "img"
                );


            imagem.src =
                photo.src;


            imagem.style.maxWidth =
                "100%";


            imagem.style.maxHeight =
                "100%";


            imagem.style.objectFit =
                "contain";


            overlay.appendChild(
                imagem
            );


            overlay.addEventListener(
                "click",
                function () {

                    overlay.remove();

                }
            );


            document.body.appendChild(
                overlay
            );

        };

}


// ============================================================
// NOME DO ARQUIVO PDF
// ============================================================

function obterNomeArquivoResposta(resposta) {

    const contentDisposition =
        resposta.headers.get("Content-Disposition") || "";

    const utf8Match =
        contentDisposition.match(
            /filename\*=UTF-8''([^;]+)/i
        );

    if (utf8Match && utf8Match[1]) {
        try {
            return decodeURIComponent(
                utf8Match[1]
            ).trim();
        } catch (erro) {
            console.warn(
                "Não foi possível decodificar o nome do arquivo:",
                erro
            );
        }
    }

    const quotedMatch =
        contentDisposition.match(
            /filename="([^"]+)"/i
        );

    if (quotedMatch && quotedMatch[1]) {
        return quotedMatch[1].trim();
    }

    const simpleMatch =
        contentDisposition.match(
            /filename=([^;]+)/i
        );

    if (simpleMatch && simpleMatch[1]) {
        return simpleMatch[1]
            .trim()
            .replace(/^['"]|['"]$/g, "");
    }

    return "RDD_PARCEIRO.pdf";
}


// ============================================================
// GERAR RDD
// ============================================================

// ============================================================
// ANIMAÇÃO "GERAR RDD" (mesma overlay do OCR)
// ============================================================

function mostrarGerandoRDD(
    totalCupons
) {

    const overlay =
        document.getElementById(
            "processingOverlay"
        );

    if (
        !overlay
    ) {

        return;

    }

    overlay.classList.add(
        "show"
    );

    overlay.setAttribute(
        "aria-hidden",
        "false"
    );

    const titulo =
        document.getElementById(
            "processingTitle"
        );

    const texto =
        document.getElementById(
            "processingText"
        );

    const contador =
        document.getElementById(
            "processingCounter"
        );

    const barra =
        document.getElementById(
            "processingProgressBar"
        );

    if (
        titulo
    ) {

        titulo.textContent =
            "⏳ Gerando RDD...";

    }

    if (
        texto
    ) {

        texto.textContent =
            "Montando a planilha, convertendo para PDF e anexando os comprovantes. Isso pode levar alguns segundos.";

    }

    if (
        contador
    ) {

        contador.textContent =
            ( Number( totalCupons ) || 0 ) +
            " cupom(ns) · aguarde...";

    }

    if (
        barra
    ) {

        /* Barra avança devagar:
           o tempo real só é conhecido
           no servidor (LibreOffice). */

        barra.style.transition =
            "none";

        barra.style.width =
            "12%";

        void barra.offsetWidth;

        barra.style.transition =
            "width 25s linear";

        barra.style.width =
            "92%";

    }

}

function finalizarGerandoRDD(
    sucesso
) {

    const overlay =
        document.getElementById(
            "processingOverlay"
        );

    if (
        !overlay
    ) {

        return;

    }

    const titulo =
        document.getElementById(
            "processingTitle"
        );

    const texto =
        document.getElementById(
            "processingText"
        );

    const contador =
        document.getElementById(
            "processingCounter"
        );

    const barra =
        document.getElementById(
            "processingProgressBar"
        );

    if (
        sucesso
    ) {

        if (
            titulo
        ) {

            titulo.textContent =
                "✅ RDD gerado!";

        }

        if (
            texto
        ) {

            texto.textContent =
                "O PDF foi criado com os comprovantes anexados.";

        }

        if (
            contador
        ) {

            contador.textContent =
                "Concluído";

        }

        if (
            barra
        ) {

            barra.style.transition =
                "none";

            barra.style.width =
                "100%";

        }

        setTimeout(
            function () {

                overlay.classList.remove(
                    "show"
                );

                overlay.setAttribute(
                    "aria-hidden",
                    "true"
                );

                if (
                    barra
                ) {

                    barra.style.transition =
                        "none";

                    barra.style.width =
                        "15%";

                }

            },
            700
        );

    } else {

        overlay.classList.remove(
            "show"
        );

        overlay.setAttribute(
            "aria-hidden",
            "true"
        );

        if (
            barra
        ) {

            barra.style.transition =
                "none";

            barra.style.width =
                "15%";

        }

    }

}

async function gerarRDD() {

    if (
        !STATE.cupons.length
    ) {

        alert(
            "Adicione pelo menos um cupom."
        );

        return;

    }


    const faltando =
        STATE.cupons.filter(
            function (cupom) {

                return (
                    !cupom.document ||
                    !cupom.category ||
                    !cupom.description
                );

            }
        );


    if (
        faltando.length
    ) {

        alert(
            "Existem cupons sem número de documento ou sem nome do estabelecimento."
        );

        return;

    }


    const nome =
        document.getElementById(
            "nome"
        );


    const cpf =
        document.getElementById(
            "cpf"
        );


    const obra =
        document.getElementById(
            "obra"
        );


    const payload = {

        nome:
            nome
                ? nome.value.trim()
                : "",

        cpf:
            cpf
                ? cpf.value.trim()
                : "",

        obra:
            obra
                ? obra.value.trim()
                : "",

        receipts:
            STATE.cupons.map(
                function (cupom) {

                    return {

                        date:
                            cupom.date || "",

                        account:
                            "",

                        description:
                            cupom.description ||
                            "",

                        document:
                            cupom.document ||
                            "",

                        category:
                            "Materiais",

                        value:
                            cupom.value ||
                            ""

                    };

                }
            )

    };


    const formData =
        new FormData();


    formData.append(
        "payload",
        JSON.stringify(
            payload
        )
    );


    STATE.cupons.forEach(
        function (cupom) {

            formData.append(
                "receipts",
                cupom.file,
                cupom.originalName
            );

        }
    );


    const generate =
        document.getElementById(
            "generate"
        );


    if (generate) {

        generate.disabled =
            true;

        generate.textContent =
            "GERANDO RDD...";

    }


    /* Mesma animação de carregamento
       que aparece ao ler o cupom. */
    mostrarGerandoRDD(
        STATE.cupons.length
    );


    try {

        const resposta =
            await fetch(
                API_URL +
                "/api/generate",
                {

                    method:
                        "POST",

                    body:
                        formData

                }
            );


        if (!resposta.ok) {

            let mensagem =
                "Erro ao gerar o RDD.";


            try {

                const erro =
                    await resposta.json();


                if (erro.detail) {

                    mensagem =
                        erro.detail;

                }

            } catch (e) {}


            throw new Error(
                mensagem
            );

        }


        const nomeArquivo =
            obterNomeArquivoResposta(
                resposta
            );


        const blob =
            await resposta.blob();


        const url =
            URL.createObjectURL(
                blob
            );


        const link =
            document.createElement(
                "a"
            );


        link.href =
            url;


        link.download =
            nomeArquivo;


        document.body.appendChild(
            link
        );


        link.click();


        link.remove();


        URL.revokeObjectURL(
            url
        );


        const message =
            document.getElementById(
                "message"
            );


        if (message) {

            message.innerHTML = `

                <div style="
                    background:#f0fdf4;
                    border:1px solid #bbf7d0;
                    color:#166534;
                    padding:15px;
                    border-radius:10px;
                ">

                    <strong>
                        RDD gerado com sucesso!
                    </strong>

                    <br><br>

                    O PDF foi gerado com os
                    comprovantes anexados.

                </div>

            `;

        }


        if (
            window.RDDMostrarTela
        ) {

            window.RDDMostrarTela(
                4
            );

        }


        finalizarGerandoRDD(
            true
        );

    } catch (erro) {

        console.error(
            "Erro ao gerar RDD:",
            erro
        );


        finalizarGerandoRDD(
            false
        );


        alert(
            "Não foi possível gerar o RDD.\n\n" +
            erro.message
        );


    } finally {

        if (generate) {

            generate.disabled =
                false;

            generate.textContent =
                "GERAR RDD + CUPONS";

        }

    }

}


// ============================================================
// VALOR
// ============================================================

function converterValor(
    valor
) {

    if (
        valor === null ||
        valor === undefined ||
        valor === ""
    ) {

        return 0;

    }


    if (
        typeof valor === "number"
    ) {

        return valor;

    }


    let texto =
        String(valor)
            .replace(
                /[R$\s]/g,
                ""
            )
            .trim();


    if (
        texto.includes(",")
    ) {

        texto =
            texto
                .replace(
                    /\./g,
                    ""
                )
                .replace(
                    ",",
                    "."
                );

    }


    const numero =
        parseFloat(
            texto
        );


    return isNaN(numero)
        ? 0
        : numero;

}


// ============================================================
// MOEDA
// ============================================================

function formatarMoeda(
    valor
) {

    return valor.toLocaleString(
        "pt-BR",
        {

            style:
                "currency",

            currency:
                "BRL"

        }
    );

}


// ============================================================
// DATA
// ============================================================

function formatarDataExibicao(
    data
) {

    if (!data) {

        return "Não identificada";

    }


    const partes =
        data.split("-");


    if (
        partes.length === 3
    ) {

        return (
            partes[2] +
            "/" +
            partes[1] +
            "/" +
            partes[0]
        );

    }


    return data;

}


// ============================================================
// ESCAPAR HTML
// ============================================================

function escapeHTML(
    texto
) {

    return String(
        texto || ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


// ============================================================
// ATIVAR ZOOM
// ============================================================

setTimeout(
    function () {

        ativarZoomImagem();

    },
    500
);
