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
                                !cupom.category
                            );

                        }
                    );


                if (
                    incompletos.length > 0
                ) {

                    alert(
                        "Existem cupons que precisam ser revisados. " +
                        "Informe o número do documento."
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
            "materiais";

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
