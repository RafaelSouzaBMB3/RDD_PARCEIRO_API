const API_URL = "https://rdd-parceiro-api-1.onrender.com";

document.addEventListener("DOMContentLoaded", function () {

    const nome = document.getElementById("nome");
    const cpf = document.getElementById("cpf");
    const obra = document.getElementById("obra");
    const periodo = document.getElementById("periodo");

    const next1 = document.getElementById("next1");

    // Período automático
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


    // Botão Avançar
    next1.addEventListener("click", function () {

        if (!nome.value.trim()) {
            alert("Informe o nome completo.");
            nome.focus();
            return;
        }

        const cpfNumeros =
            cpf.value.replace(/\D/g, "");

        if (cpfNumeros.length !== 11) {
            alert("Informe um CPF válido com 11 números.");
            cpf.focus();
            return;
        }

        if (!obra.value.trim()) {
            alert("Informe a obra / projeto.");
            obra.focus();
            return;
        }

        document
            .querySelectorAll(".screen")
            .forEach(function (tela) {
                tela.classList.remove("on");
            });

        document
            .getElementById("cupons")
            .classList.add("on");

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    });

});
const cameraInput = document.getElementById("cameraInput");
const galleryInput = document.getElementById("galleryInput");

const takePhoto = document.getElementById("takePhoto");
const selectPhoto = document.getElementById("selectPhoto");


takePhoto.addEventListener("click", function () {
    cameraInput.click();
});


selectPhoto.addEventListener("click", function () {
    galleryInput.click();
});


cameraInput.addEventListener("change", function () {

    if (cameraInput.files.length > 0) {

        console.log(
            "Foto tirada:",
            cameraInput.files[0].name
        );

        alert(
            "Foto adicionada: " +
            cameraInput.files[0].name
        );

    }

});


galleryInput.addEventListener("change", function () {

    if (galleryInput.files.length > 0) {

        console.log(
            "Fotos selecionadas:",
            galleryInput.files.length
        );

        alert(
            galleryInput.files.length +
            " foto(s) selecionada(s)."
        );

    }

});
