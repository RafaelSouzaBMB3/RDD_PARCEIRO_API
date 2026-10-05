const API_URL = "https://rdd-parceiro-api-1.onrender.com";

document.addEventListener("DOMContentLoaded", function () {

    // =====================================================
    // ELEMENTOS
    // =====================================================

    const nome = document.getElementById("nome");
    const cpf = document.getElementById("cpf");
    const obra = document.getElementById("obra");
    const periodo = document.getElementById("periodo");

    const next1 = document.getElementById("next1");
    const back1 = document.getElementById("back1");
    const next2 = document.getElementById("next2");
    const back2 = document.getElementById("back2");
    const generate = document.getElementById("generate");
    const novo = document.getElementById("new");

    const cameraInput = document.getElementById("cameraInput");
    const galleryInput = document.getElementById("galleryInput");

    const takePhoto = document.getElementById("takePhoto");
    const selectPhoto = document.getElementById("selectPhoto");

    const filesInput = document.getElementById("files");


    // =====================================================
    // TELAS
    // =====================================================

    const telas = {
        1: document.getElementById("dados"),
        2: document.getElementById("cupons"),
        3: document.getElementById("revisao"),
        4: document.getElementById("final")
    };


    const etapas = document.querySelectorAll(".progress .step");


    // =====================================================
    // CONTROLADOR CENTRAL DE TELAS
    // =====================================================

    function mostrarTela(numero) {

        console.log("Mudando para tela:", numero);


        // Esconde todas
        Object.keys(telas).forEach(function (chave) {

            const tela = telas[chave];

            if (!tela) return;

            tela.classList.remove("on");
            tela.classList.remove("active");

            tela.style.display = "none";

        });


        // Mostra somente a tela desejada
        const telaAtual = telas[numero];

        if (telaAtual) {

            telaAtual.classList.add("on");
            telaAtual.classList.add("active");

            telaAtual.style.display = "block";

        }


        // Atualiza barra de progresso
        etapas.forEach(function (etapa, index) {

            const numeroEtapa = index + 1;

            etapa.classList.remove("active");
            etapa.classList.remove("done");


            if (numeroEtapa < numero) {
                etapa.classList.add("done");
            }


            if (numeroEtapa === numero) {
                etapa.classList.add("active");
            }

        });


        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    }


    // =====================================================
    // PERÍODO AUTOMÁTICO
    // =====================================================

    if (periodo) {

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


        periodo.value =
            primeiroDia.toLocaleDateString("pt-BR") +
            " até " +
            ultimoDia.toLocaleDateString("pt-BR");

    }


    // =====================================================
    // ETAPA 1 → ETAPA 2
    // =====================================================

    if (next1) {

        next1.type = "button";


        next1.addEventListener("click", function (event) {

            event.preventDefault();
            event.stopPropagation();


            console.log("BOTÃO CONTINUAR CLICADO");


            // Nome
            if (!nome || !nome.value.trim()) {

                alert("Informe o nome completo.");

                if (nome) {
                    nome.focus();
                }

                return;

            }


            // CPF
            const cpfNumeros =
                cpf ? cpf.value.replace(/\D/g, "") : "";


            if (cpfNumeros.length !== 11) {

                alert(
                    "Informe um CPF válido com 11 números."
                );

                if (cpf) {
                    cpf.focus();
                }

                return;

            }


            // Obra
            if (!obra || !obra.value.trim()) {

                alert(
                    "Informe a obra / projeto."
                );

                if (obra) {
                    obra.focus();
                }

                return;

            }


            // Vai para tela 2
            mostrarTela(2);

        });

    }


    // =====================================================
    // ETAPA 2 → ETAPA 1
    // =====================================================

    if (back1) {

        back1.type = "button";


        back1.addEventListener("click", function (event) {

            event.preventDefault();

            mostrarTela(1);

        });

    }


    // =====================================================
    // ETAPA 2 → ETAPA 3
    // =====================================================

    if (next2) {

        next2.type = "button";


        next2.addEventListener("click", function (event) {

            event.preventDefault();


            console.log(
                "Indo para a revisão"
            );


            // Atualiza resumo
            const reviewNome =
                document.getElementById("reviewNome");

            const reviewCpf =
                document.getElementById("reviewCpf");

            const reviewObra =
                document.getElementById("reviewObra");

            const reviewCount =
                document.getElementById("reviewCount");

            const reviewTotal =
                document.getElementById("reviewTotal");


            const count =
                document.getElementById("count");

            const sum =
                document.getElementById("sum");


            if (reviewNome) {
                reviewNome.textContent =
                    nome ? nome.value : "-";
            }


            if (reviewCpf) {
                reviewCpf.textContent =
                    cpf ? cpf.value : "-";
            }


            if (reviewObra) {
                reviewObra.textContent =
                    obra ? obra.value : "-";
            }


            if (reviewCount) {
                reviewCount.textContent =
                    count ? count.textContent : "0";
            }


            if (reviewTotal) {
                reviewTotal.textContent =
                    sum ? sum.textContent : "R$ 0,00";
            }


            mostrarTela(3);

        });

    }


    // =====================================================
    // ETAPA 3 → ETAPA 2
    // =====================================================

    if (back2) {

        back2.type = "button";


        back2.addEventListener("click", function (event) {

            event.preventDefault();

            mostrarTela(2);

        });

    }


    // =====================================================
    // NOVO RDD
    // =====================================================

    if (novo) {

        novo.type = "button";


        novo.addEventListener("click", function (event) {

            event.preventDefault();

            mostrarTela(1);

        });

    }


    // =====================================================
    // CÂMERA
    // =====================================================

    if (takePhoto && cameraInput) {

        takePhoto.addEventListener(
            "click",
            function () {

                cameraInput.click();

            }
        );

    }


    // =====================================================
    // GALERIA
    // =====================================================

    if (selectPhoto && galleryInput) {

        selectPhoto.addEventListener(
            "click",
            function () {

                galleryInput.click();

            }
        );

    }


    // =====================================================
    // CÂMERA → INPUT PRINCIPAL
    // =====================================================

    if (cameraInput) {

        cameraInput.addEventListener(
            "change",
            function () {

                if (!cameraInput.files.length) {
                    return;
                }


                transferirArquivos(
                    cameraInput.files
                );

            }
        );

    }


    // =====================================================
    // GALERIA → INPUT PRINCIPAL
    // =====================================================

    if (galleryInput) {

        galleryInput.addEventListener(
            "change",
            function () {

                if (!galleryInput.files.length) {
                    return;
                }


                transferirArquivos(
                    galleryInput.files
                );

            }
        );

    }


    // =====================================================
    // TRANSFERIR ARQUIVOS
    // =====================================================

    function transferirArquivos(arquivos) {

        if (!filesInput) {
            return;
        }


        const dataTransfer =
            new DataTransfer();


        // Mantém arquivos já selecionados
        Array.from(filesInput.files)
            .forEach(function (arquivo) {

                dataTransfer.items.add(arquivo);

            });


        // Adiciona novos
        Array.from(arquivos)
            .forEach(function (arquivo) {

                dataTransfer.items.add(arquivo);

            });


        filesInput.files =
            dataTransfer.files;


        console.log(
            "Total de arquivos:",
            filesInput.files.length
        );


        // Atualiza status
        const status =
            document.getElementById("uploadStatus");

        const statusTitle =
            document.getElementById("uploadStatusTitle");

        const statusText =
            document.getElementById("uploadStatusText");

        const summary =
            document.getElementById("selectedFilesSummary");


        if (status) {
            status.classList.add("show");
        }


        if (statusTitle) {

            statusTitle.textContent =
                "Comprovantes selecionados";

        }


        if (statusText) {

            statusText.textContent =
                filesInput.files.length +
                " arquivo(s) selecionado(s).";

        }


        if (summary) {

            summary.textContent =
                Array.from(filesInput.files)
                    .map(function (arquivo) {
                        return arquivo.name;
                    })
                    .join(", ");

        }


        // Dispara change
        filesInput.dispatchEvent(
            new Event("change", {
                bubbles: true
            })
        );

    }


    // =====================================================
    // CATEGORIA PADRÃO
    // =====================================================

    const mcat =
        document.getElementById("mcat");


    if (mcat) {

        mcat.value = "materiais";

    }


    // =====================================================
    // INICIALIZAÇÃO
    // =====================================================

    mostrarTela(1);


});
