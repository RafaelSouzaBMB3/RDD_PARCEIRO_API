const API_URL = "https://rdd-parceiro-api-1.onrender.com";


// ============================================================
// ESTADO GLOBAL ÚNICO
// ============================================================

// ============================================================
// PARTE 1
// ============================================================

// ========================================================
// ARQUIVOS
// ========================================================

if (filesInput) {

    filesInput.addEventListener(
        "change",
        async function (event) {

            event.preventDefault();

            const arquivos =
                Array.from(
                    event.target.files || []
                );

            if (!arquivos.length) {
                return;
            }

            console.log(
                "Arquivos recebidos:",
                arquivos.length
            );

            try {

                await processarArquivos(
                    arquivos
                );

            } catch (erro) {

                console.error(
                    "Erro ao processar arquivos:",
                    erro
                );

                alert(
                    "Não foi possível processar os comprovantes. Tente novamente."
                );

            } finally {

                // Permite selecionar novamente o mesmo arquivo.
                event.target.value = "";

            }

        },
        false
    );

}



// ============================================================
// PARTE 2
// ============================================================

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
            "materiais";

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
            "materiais";

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


    cupom.date =
        mdate
            ? mdate.value
            : "";


    cupom.category =
        "materiais";


    cupom.description =
        mdesc
            ? mdesc.value.trim()
            : "";


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
// PARTE 3
// ============================================================
// ============================================================
// GERAR RDD
// ============================================================

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
                    !cupom.category
                );

            }
        );


    if (
        faltando.length
    ) {

        alert(
            "Existem cupons sem número de documento."
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
                            "materiais",

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
            "RDD_PARCEIRO.pdf";


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


    } catch (erro) {

        console.error(
            "Erro ao gerar RDD:",
            erro
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

// ============================================================
// PARTE 4
// ============================================================
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
                    !cupom.category
                );

            }
        );


    if (
        faltando.length
    ) {

        alert(
            "Existem cupons sem número de documento."
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
                            "materiais",

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


    } catch (erro) {

        console.error(
            "Erro ao gerar RDD:",
            erro
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
