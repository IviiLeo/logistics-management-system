const USUARIOS_FALSOS = [
    { mail: "admin@empresa.com", contrasena: "1234", activo: true },
    { mail: "inactivo@empresa.com", contrasena: "1234", activo: false }
];

const FORMATO_MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const boton = document.querySelector("#form-login button");
const inputMail = document.getElementById("mail");
const inputContrasena = document.getElementById("contrasena");
const errorMail = document.getElementById("error-mail");
const errorContrasena = document.getElementById("error-contrasena");
const mensaje = document.getElementById("mensaje-error");

function mostrarMensaje(texto, tipo) {
    mensaje.textContent = texto;
    if (tipo === "exito") {
        mensaje.className = "mensaje-exito";
    } else {
        mensaje.className = "mensaje-error";
    }
    mensaje.hidden = false;
}

function ocultarMensaje() {
    mensaje.hidden = true;
}

function marcarCampo(input, parrafoError, texto) {
    parrafoError.textContent = texto;
    parrafoError.hidden = false;
    input.classList.add("campo-invalido");
}

function limpiarCampo(input, parrafoError) {
    parrafoError.hidden = true;
    input.classList.remove("campo-invalido");
}

boton.addEventListener("click", function (evento) {
    evento.preventDefault();

    ocultarMensaje();
    limpiarCampo(inputMail, errorMail);
    limpiarCampo(inputContrasena, errorContrasena);

    const mail = inputMail.value.trim();
    const contrasena = inputContrasena.value;

    let hayErrores = false;

    if (mail === "") {
        marcarCampo(inputMail, errorMail, "Ingresá tu correo electrónico.");
        hayErrores = true;
    } else if (!FORMATO_MAIL.test(mail)) {
        marcarCampo(inputMail, errorMail, "Ingresá un correo electrónico válido.");
        hayErrores = true;
    }

    if (contrasena === "") {
        marcarCampo(inputContrasena, errorContrasena, "Ingresá tu contraseña.");
        hayErrores = true;
    }

    if (hayErrores) {
        return;
    }

    const usuario = USUARIOS_FALSOS.find(function (u) {
        return u.mail === mail && u.contrasena === contrasena;
    });

    if (!usuario) {
        mostrarMensaje("Correo electrónico o contraseña incorrectos", "error");
        inputContrasena.value = "";
        inputContrasena.focus();
        return;
    }

    if (!usuario.activo) {
        mostrarMensaje("Su cuenta se encuentra inhabilitada. Contacte al administrador del sistema.", "error");
        return;
    }

    mostrarMensaje("¡Bienvenido! Inicio de sesión correcto.", "exito");
});
