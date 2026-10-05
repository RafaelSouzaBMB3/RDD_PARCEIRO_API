const API_URL = "https://rdd-parceiro-api-1.onrender.com";

document.addEventListener("DOMContentLoaded", function () {

    const next1 = document.getElementById("next1");

    if (!next1) {
        console.error("Botão next1 não encontrado.");
        return;
    }

    next1.addEventListener("click", function () {

        const nome = document.getElementById("nome").value.trim();
        const cpf = document.getElementById("cpf").value.trim();
        const obra = document.getElementById("obra").value.trim();

        if (!nome) {
            alert("Informe o nome completo.");
            return;
        }

        if (!cpf) {
            alert("Informe o CPF.");
            return;
        }

        if (cpf.replace(/\D/g, "").length !== 11) {
            alert("Informe um CPF válido com 11 números.");
            return;
        }

        if (!obra) {
            alert("Informe a obra / projeto.");
            return;
        }

        document.querySelectorAll(".screen").forEach(function (tela) {
            tela.classList.remove("on");
        });

        document.getElementById("cupons").classList.add("on");

        console.log("Etapa 1 concluída.");

    });

});
