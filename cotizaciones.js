function formatoPeso(valor) {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0
    }).format(valor);
}

function formatoNumero(valor) {
    return new Intl.NumberFormat("es-CO", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(valor);
}

function normalizarNumero(valor) {
    const numero = Number.parseFloat(valor);
    return Number.isFinite(numero) ? numero : 0;
}

function redondearMoneda(valor) {
    return Math.round(normalizarNumero(valor) + Number.EPSILON);
}

function calcularSubtotal(cantidad, precio) {
    return redondearMoneda(normalizarNumero(cantidad) * normalizarNumero(precio));
}

function obtenerSubtotalProducto(producto) {
    if (!producto) {
        return 0;
    }

    if (Number.isFinite(producto.subtotal)) {
        return redondearMoneda(producto.subtotal);
    }

    return calcularSubtotal(producto.cantidad, producto.precio);
}

function normalizarTexto(texto) {
    return (texto || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function escaparHtml(texto) {
    return (texto || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function obtenerTituloProducto(producto) {
    return (producto.titulo || producto.descripcion || "").trim();
}

function obtenerSubtituloProducto(producto) {
    return (producto.subtitulo || "").trim();
}

function obtenerTextoProducto(producto) {
    return `${obtenerTituloProducto(producto)} ${obtenerSubtituloProducto(producto)}`.trim();
}

function esProductoInstalacion(producto) {
    return normalizarTexto(obtenerTextoProducto(producto)).includes("instalacion");
}

function esProductoSinDescuento(producto) {
    const descripcion = normalizarTexto(obtenerTextoProducto(producto));
    return descripcion.includes("instalacion") || descripcion.includes("mantenimiento");
}

let productos = [];
let descuentosPorOpcion = {};
let opcionActual = 1;
let ultimaOpcionCreada = 1;
const opcionesCreadas = new Set([1]);
let productoEditandoId = null;
let editarInstalacionModal = null;
const UNIDAD_DEFAULT = "Unidades";
let notaConfirmada = false;
const IVA_PORCENTAJES = Object.freeze([5, 19]);
const IVA_PORCENTAJE_DEFAULT = 0;

function obtenerIvaPorcentaje(producto) {
    const iva = Number.parseInt(producto?.ivaPercent, 10);
    return IVA_PORCENTAJES.includes(iva) ? iva : IVA_PORCENTAJE_DEFAULT;
}

function calcularTotalConIva(subtotal, ivaPercent) {
    return redondearMoneda(subtotal * (1 + ivaPercent / 100));
}

function calcularValoresProducto(producto) {
    const subtotal = obtenerSubtotalProducto(producto);
    const ivaPercent = obtenerIvaPorcentaje(producto);
    const totalConIva = calcularTotalConIva(subtotal, ivaPercent);
    const totalMostrado = ivaPercent > 0 ? totalConIva : subtotal;

    return {
        subtotal,
        ivaPercent,
        totalConIva,
        totalMostrado
    };
}


function leerImagenProducto() {
    return leerImagenDesdeInput("imagenProducto");
}

function leerImagenDesdeInput(inputId) {
    const inputImagen = document.getElementById(inputId);
    const archivo = inputImagen && inputImagen.files ? inputImagen.files[0] : null;

    if (!archivo) {
        return Promise.resolve("");
    }

    return new Promise((resolve) => {
        const lector = new FileReader();
        lector.onload = () => resolve(lector.result);
        lector.onerror = () => resolve("");
        lector.readAsDataURL(archivo);
    });
}

function toggleUnidadPersonalizada(selectEl, inputEl) {
    if (!selectEl || !inputEl) {
        return;
    }

    const esOtra = selectEl.value === "otra";
    inputEl.classList.toggle("d-none", !esOtra);
    if (!esOtra) {
        inputEl.value = "";
    }
}

function leerUnidadSeleccionada(selectId, inputId) {
    const selectEl = document.getElementById(selectId);
    if (!selectEl) {
        return "";
    }

    if (selectEl.value === "otra") {
        const inputEl = document.getElementById(inputId);
        return inputEl ? inputEl.value.trim() : "";
    }

    return selectEl.value.trim();
}

function aplicarUnidadSeleccionada(selectId, inputId, unidad) {
    const selectEl = document.getElementById(selectId);
    const inputEl = document.getElementById(inputId);

    if (!selectEl || !inputEl) {
        return;
    }

    const opciones = Array.from(selectEl.options).map((option) => option.value);
    if (unidad && opciones.includes(unidad) && unidad !== "otra") {
        selectEl.value = unidad;
        inputEl.classList.add("d-none");
        inputEl.value = "";
        return;
    }

    selectEl.value = "otra";
    inputEl.classList.remove("d-none");
    inputEl.value = unidad || "";
}

function toggleVendedorOtro(selectEl, inputEl) {
    if (!selectEl || !inputEl) {
        return;
    }

    const esOtro = selectEl.value === "Otro";
    inputEl.classList.toggle("d-none", !esOtro);
    if (!esOtro) {
        inputEl.value = "";
    }
}

function obtenerOpcionesDisponibles() {
    const opciones = new Set(opcionesCreadas);
    productos.forEach((producto) => {
        const opcion = Number.parseInt(producto.opcion, 10);
        if (Number.isFinite(opcion) && opcion > 0) {
            opciones.add(opcion);
        }
    });

    return Array.from(opciones)
        .filter((opcion) => Number.isFinite(opcion) && opcion > 0)
        .sort((a, b) => a - b);
}

function sincronizarOpcionesDisponibles() {
    const opcionActivaSelect = document.getElementById("opcionActiva");
    const opciones = obtenerOpcionesDisponibles();
    const opcionMayor = opciones.length > 0 ? opciones[opciones.length - 1] : 1;
    if (opcionMayor > ultimaOpcionCreada) {
        ultimaOpcionCreada = opcionMayor;
    }

    if (!opciones.includes(opcionActual)) {
        opcionActual = opciones[0] || 1;
    }

    if (!opcionActivaSelect) {
        return;
    }

    opcionActivaSelect.innerHTML = opciones
        .map((opcion) => `<option value="${opcion}">Opción ${opcion}</option>`)
        .join("");

    opcionActivaSelect.value = String(opcionActual);
}

document.addEventListener("DOMContentLoaded", () => {
    const fecha = new Date();
    const opcionesFecha = { day: "numeric", month: "long", year: "numeric" };
    const fechaFormateada = fecha.toLocaleDateString("es-CO", opcionesFecha);
    document.getElementById("fecha").innerText = `Armenia, ${fechaFormateada}`;

    document.getElementById("agregarProducto").addEventListener("click", agregarProducto);
    document.getElementById("generarPDF").addEventListener("click", () => window.print());
    document.getElementById("agregarTabla").addEventListener("click", agregarNuevaTabla);
    document.getElementById("genero").addEventListener("change", actualizarSaludo);
    document.getElementById("cliente").addEventListener("input", actualizarSaludo);
    document.getElementById("guardarEdicionInstalacion").addEventListener("click", guardarEdicionProducto);

    const unidadSelect = document.getElementById("unidadCantidad");
    const unidadPersonalizada = document.getElementById("unidadPersonalizada");
    if (unidadSelect && unidadPersonalizada) {
        unidadSelect.addEventListener("change", () => toggleUnidadPersonalizada(unidadSelect, unidadPersonalizada));
        toggleUnidadPersonalizada(unidadSelect, unidadPersonalizada);
    }

    const editarUnidadSelect = document.getElementById("editarUnidad");
    const editarUnidadPersonalizada = document.getElementById("editarUnidadPersonalizada");
    if (editarUnidadSelect && editarUnidadPersonalizada) {
        editarUnidadSelect.addEventListener("change", () => toggleUnidadPersonalizada(editarUnidadSelect, editarUnidadPersonalizada));
        toggleUnidadPersonalizada(editarUnidadSelect, editarUnidadPersonalizada);
    }

    const editarImagenProducto = document.getElementById("editarImagenProducto");
    const quitarImagenEditar = document.getElementById("quitarImagenEditar");
    if (editarImagenProducto && quitarImagenEditar) {
        editarImagenProducto.addEventListener("change", () => {
            if (editarImagenProducto.files && editarImagenProducto.files.length > 0) {
                quitarImagenEditar.checked = false;
            }
        });
    }

    const descuentoOpcionUnicaInput = document.getElementById("descuentoOpcionUnica");
    if (descuentoOpcionUnicaInput) {
        descuentoOpcionUnicaInput.addEventListener("change", aplicarDescuentoOpcionUnica);
    }

    const vendedorSelect = document.getElementById("vendedor");
    const vendedorOtroInput = document.getElementById("vendedorOtro");
    if (vendedorSelect) {
        vendedorSelect.addEventListener("change", () => {
            toggleVendedorOtro(vendedorSelect, vendedorOtroInput);
            actualizarNombreVendedor();
        });
        toggleVendedorOtro(vendedorSelect, vendedorOtroInput);
    }
    if (vendedorOtroInput) {
        vendedorOtroInput.addEventListener("input", actualizarNombreVendedor);
    }

    const notaRapidaInput = document.getElementById("notaRapidaInput");
    const agregarNotaBtn = document.getElementById("agregarNota");
    const eliminarNotaBtn = document.getElementById("eliminarNota");
    if (agregarNotaBtn) {
        agregarNotaBtn.addEventListener("click", () => {
            notaConfirmada = true;
            actualizarNotaRapida();
        });
    }
    if (eliminarNotaBtn) {
        eliminarNotaBtn.addEventListener("click", () => {
            notaConfirmada = false;
            if (notaRapidaInput) {
                notaRapidaInput.value = "";
            }
            actualizarNotaRapida();
        });
    }

    if (window.bootstrap) {
        const modalElement = document.getElementById("editarInstalacionModal");
        editarInstalacionModal = new window.bootstrap.Modal(modalElement);
    }

    const opcionActivaSelect = document.getElementById("opcionActiva");
    if (opcionActivaSelect) {
        opcionActivaSelect.addEventListener("change", () => {
            const opcionSeleccionada = Number.parseInt(opcionActivaSelect.value, 10);
            if (Number.isFinite(opcionSeleccionada) && opcionSeleccionada > 0) {
                opcionActual = opcionSeleccionada;
            }
        });
    }

    sincronizarOpcionesDisponibles();
    actualizarSaludo();
    actualizarNombreVendedor();
    actualizarNotaRapida();
    renderizarTabla();
    calcularTotales();

    // Botón para ocultar/mostrar totales generales
    const totalesGenerales = document.getElementById("totalesGenerales");
    const toggleTotalesBtn = document.getElementById("toggleTotalesBtn");
    if (toggleTotalesBtn && totalesGenerales) {
        toggleTotalesBtn.addEventListener("click", () => {
            const visible = totalesGenerales.classList.toggle("d-none");
            toggleTotalesBtn.textContent = visible ? "Mostrar total general" : "Ocultar total general";
        });
    }
});

async function agregarProducto() {
    const cliente = document.getElementById("cliente").value.trim();
    const titulo = document.getElementById("producto").value.trim();
    const subtitulo = document.getElementById("productoDescripcion").value.trim();
    const cantidad = Number.parseFloat(document.getElementById("cantidad").value);
    const precio = Number.parseFloat(document.getElementById("precio").value);
    const unidad = leerUnidadSeleccionada("unidadCantidad", "unidadPersonalizada");
    const imagen = await leerImagenProducto();

    if (!titulo || !Number.isFinite(cantidad) || !Number.isFinite(precio) || cantidad <= 0 || precio <= 0) {
        alert("Complete producto, cantidad y precio con valores válidos.");
        return;
    }

    if (!unidad) {
        alert("Indique la unidad de medida para la cantidad.");
        return;
    }

    const subtotal = calcularSubtotal(cantidad, precio);

    productos.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        titulo,
        subtitulo,
        descripcion: titulo,
        cantidad,
        unidad,
        precio,
        subtotal,
        imagen,
        ivaPercent: IVA_PORCENTAJE_DEFAULT
    });

    document.getElementById("nombreCliente").innerText = cliente;
    renderizarTabla();
    calcularTotales();

    document.getElementById("producto").value = "";
    document.getElementById("productoDescripcion").value = "";
    document.getElementById("cantidad").value = "";
    document.getElementById("precio").value = "";
    document.getElementById("imagenProducto").value = "";
    const unidadSelect = document.getElementById("unidadCantidad");
    const unidadPersonalizada = document.getElementById("unidadPersonalizada");
    if (unidadSelect) {
        unidadSelect.value = UNIDAD_DEFAULT;
    }
    if (unidadPersonalizada) {
        unidadPersonalizada.value = "";
        unidadPersonalizada.classList.add("d-none");
    }
}

function obtenerDescuentoOpcion(opcion) {
    const key = String(opcion);
    const descuento = Number.parseFloat(descuentosPorOpcion[key]);
    if (!Number.isFinite(descuento)) {
        return 0;
    }

    return Math.max(0, Math.min(100, descuento));
}

function actualizarDescuentoOpcion(opcion, valor) {
    const key = String(opcion);
    const descuento = Number.parseFloat(valor);
    descuentosPorOpcion[key] = Number.isFinite(descuento) ? Math.max(0, Math.min(100, descuento)) : 0;
    renderizarTabla();
    calcularTotales();
}

function aplicarDescuentoOpcionUnica() {
    const descuentoOpcionUnicaInput = document.getElementById("descuentoOpcionUnica");
    const opciones = agruparPorOpcion(productos);
    const opcion = Object.keys(opciones)[0] || String(opcionActual || 1);
    const valor = descuentoOpcionUnicaInput ? descuentoOpcionUnicaInput.value : 0;
    actualizarDescuentoOpcion(opcion, valor);
}

function calcularValorIvaProducto(producto, descuentoPorcentaje) {
    if (!producto) {
        return 0;
    }

    const subtotal = obtenerSubtotalProducto(producto);
    const subtotalConDescuento = esProductoSinDescuento(producto)
        ? subtotal
        : subtotal * (1 - descuentoPorcentaje / 100);
    const ivaPercent = obtenerIvaPorcentaje(producto);
    if (ivaPercent <= 0) {
        return 0;
    }
    return redondearMoneda(subtotalConDescuento * (ivaPercent / 100));
}

function calcularResumenOpcion(productosOpcion, opcion) {
    const descuentoPorcentaje = obtenerDescuentoOpcion(opcion);
    const subtotalConDescuento = redondearMoneda(
        productosOpcion
            .filter((producto) => !esProductoSinDescuento(producto))
            .reduce((acc, producto) => acc + obtenerSubtotalProducto(producto), 0)
    );
    const subtotalSinDescuento = redondearMoneda(
        productosOpcion
            .filter((producto) => esProductoSinDescuento(producto))
            .reduce((acc, producto) => acc + obtenerSubtotalProducto(producto), 0)
    );
    const subtotal = redondearMoneda(subtotalConDescuento + subtotalSinDescuento);
    const valorDescuento = redondearMoneda(subtotalConDescuento * (descuentoPorcentaje / 100));
    const totalSinIva = redondearMoneda(subtotalConDescuento - valorDescuento + subtotalSinDescuento);
    const valorIva = redondearMoneda(
        productosOpcion.reduce(
            (acc, producto) => acc + calcularValorIvaProducto(producto, descuentoPorcentaje),
            0
        )
    );
    const total = redondearMoneda(totalSinIva + valorIva);

    return {
        subtotal,
        descuentoPorcentaje,
        valorDescuento,
        valorIva,
        totalSinIva,
        total
    };
}

function eliminarProducto(id) {
    productos = productos.filter((producto) => producto.id !== id);
    renderizarTabla();
    calcularTotales();
}

function abrirModalEdicion(id) {
    const producto = productos.find((item) => item.id === id);
    if (!producto) {
        return;
    }

    productoEditandoId = id;
    document.getElementById("editarTitulo").value = obtenerTituloProducto(producto);
    document.getElementById("editarSubtitulo").value = obtenerSubtituloProducto(producto);
    document.getElementById("editarCantidad").value = producto.cantidad;
    aplicarUnidadSeleccionada("editarUnidad", "editarUnidadPersonalizada", producto.unidad);
    document.getElementById("editarPrecio").value = producto.precio;
    const editarImagenProducto = document.getElementById("editarImagenProducto");
    const quitarImagenEditar = document.getElementById("quitarImagenEditar");
    if (editarImagenProducto) {
        editarImagenProducto.value = "";
    }
    if (quitarImagenEditar) {
        quitarImagenEditar.checked = false;
    }

    if (editarInstalacionModal) {
        editarInstalacionModal.show();
    }
}

async function guardarEdicionProducto() {
    if (productoEditandoId === null) {
        return;
    }

    const titulo = document.getElementById("editarTitulo").value.trim();
    const subtitulo = document.getElementById("editarSubtitulo").value.trim();
    const cantidad = Number.parseFloat(document.getElementById("editarCantidad").value);
    const precio = Number.parseFloat(document.getElementById("editarPrecio").value);
    const unidad = leerUnidadSeleccionada("editarUnidad", "editarUnidadPersonalizada");

    if (!titulo || !Number.isFinite(cantidad) || !Number.isFinite(precio) || cantidad <= 0 || precio <= 0) {
        alert("Complete producto, cantidad y precio con valores válidos.");
        return;
    }

    if (!unidad) {
        alert("Indique la unidad de medida para la cantidad.");
        return;
    }

    const indice = productos.findIndex((item) => item.id === productoEditandoId);
    if (indice === -1) {
        return;
    }

    const nuevaImagen = await leerImagenDesdeInput("editarImagenProducto");
    const quitarImagenEditar = document.getElementById("quitarImagenEditar");
    const quitarImagen = quitarImagenEditar ? quitarImagenEditar.checked : false;
    let imagenFinal = productos[indice].imagen || "";
    if (nuevaImagen) {
        imagenFinal = nuevaImagen;
    } else if (quitarImagen) {
        imagenFinal = "";
    }

    productos[indice].titulo = titulo;
    productos[indice].subtitulo = subtitulo;
    productos[indice].descripcion = titulo;
    productos[indice].cantidad = cantidad;
    productos[indice].unidad = unidad;
    productos[indice].precio = precio;
    productos[indice].subtotal = calcularSubtotal(cantidad, precio);
    productos[indice].imagen = imagenFinal;

    renderizarTabla();
    calcularTotales();

    if (editarInstalacionModal) {
        editarInstalacionModal.hide();
    }

    productoEditandoId = null;
}

function agregarNuevaTabla() {
    ultimaOpcionCreada += 1;
    opcionActual = ultimaOpcionCreada;
    opcionesCreadas.add(opcionActual);
    sincronizarOpcionesDisponibles();
    alert(`Nueva opción ${opcionActual} creada. Los siguientes productos pertenecerán a esta opción.`);
}

function renderizarDescripcionProducto(producto) {
    const tituloSeguro = escaparHtml(obtenerTituloProducto(producto));
    const subtituloSeguro = escaparHtml(obtenerSubtituloProducto(producto));

    if (subtituloSeguro) {
        return `
            <div class="descripcion-producto">
                <div class="descripcion-producto-titulo">${tituloSeguro}</div>
                <div class="descripcion-producto-subtitulo">${subtituloSeguro}</div>
            </div>
        `;
    }

    return `
        <div class="descripcion-producto">
            <div class="descripcion-producto-titulo">${tituloSeguro}</div>
        </div>
    `;
}

function renderizarCantidadProducto(producto) {
    const cantidadTexto = formatoNumero(normalizarNumero(producto.cantidad));
    const unidadTexto = escaparHtml((producto.unidad || "").trim());

    if (!unidadTexto) {
        return `<span class="valor-principal">${cantidadTexto}</span>`;
    }

    return `
        <span class="cantidad-wrap">
            <span class="valor-principal">${cantidadTexto}</span>
            <span class="cantidad-unidad">${unidadTexto}</span>
        </span>
    `;
}

function renderizarSeleccionIvaProducto(producto, ivaPercent) {
    const checkedIva5 = ivaPercent === 5 ? "checked" : "";
    const checkedIva19 = ivaPercent === 19 ? "checked" : "";

    return `
        <div class="seleccion-iva-wrap">
            <div class="iva-mini-list">
                <label class="iva-mini-item">
                    <input
                        type="checkbox"
                        class="form-check-input"
                        ${checkedIva5}
                        onchange="toggleIvaProducto(${producto.id}, 5, this.checked)"
                        aria-label="IVA 5 por ciento"
                    >
                    <span>5%</span>
                </label>
                <label class="iva-mini-item">
                    <input
                        type="checkbox"
                        class="form-check-input"
                        ${checkedIva19}
                        onchange="toggleIvaProducto(${producto.id}, 19, this.checked)"
                        aria-label="IVA 19 por ciento"
                    >
                    <span>19%</span>
                </label>
            </div>
        </div>
    `;
}

function tieneImagenProducto(producto) {
    return Boolean((producto?.imagen || "").trim());
}

function renderizarImagenProducto(producto) {
    if (!tieneImagenProducto(producto)) {
        return '<span class="text-muted">-</span>';
    }

    return `<img src="${producto.imagen}" alt="Imagen del producto" class="producto-img-tabla">`;
}

function renderizarTabla() {
    const tbody = document.getElementById("tablaBody");
    const columnaImagen = document.getElementById("columnaImagen");
    const mostrarColumnaImagen = productos.some((producto) => tieneImagenProducto(producto));

    if (columnaImagen) {
        columnaImagen.classList.toggle("d-none", !mostrarColumnaImagen);
    }

    tbody.innerHTML = "";
    if (productos.length === 0) {
        tbody.innerHTML = `
            <tr class="tabla-vacia">
                <td colspan="${mostrarColumnaImagen ? 8 : 7}">No hay productos agregados</td>
            </tr>
        `;
        return;
    }

    productos.forEach((producto) => {
        const tr = document.createElement("tr");
        const valores = calcularValoresProducto(producto);
        producto.subtotal = valores.subtotal;

        tr.innerHTML = `
            <td class="seleccion-iva-cell">${renderizarSeleccionIvaProducto(producto, valores.ivaPercent)}</td>
            <td>${renderizarDescripcionProducto(producto)}</td>
            <td class="text-end">
                ${renderizarCantidadProducto(producto)}
            </td>
            <td class="text-end valor-principal">${formatoPeso(normalizarNumero(producto.precio))}</td>
            <td class="text-end valor-principal">${formatoPeso(valores.subtotal)}</td>
            <td class="text-end valor-principal">${formatoPeso(valores.totalMostrado)}</td>
            <td class="text-center columna-acciones-celda">
                <div class="acciones-wrap">
                    <button class="btn-tabla-accion" onclick="abrirModalEdicion(${producto.id})" aria-label="Editar producto">
                    <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn-tabla-accion btn-tabla-danger" onclick="eliminarProducto(${producto.id})" aria-label="Eliminar producto">
                    <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
            ${mostrarColumnaImagen ? `<td class="columna-imagen-celda">${renderizarImagenProducto(producto)}</td>` : ""}
        `;
        tbody.appendChild(tr);
    });
}

window.toggleIvaProducto = function(id, ivaPercent, checked) {
    const prod = productos.find((p) => p.id === id);
    if (!prod) {
        return;
    }

    const ivaNormalizado = Number.parseInt(ivaPercent, 10);
    if (!IVA_PORCENTAJES.includes(ivaNormalizado)) {
        return;
    }

    if (checked) {
        prod.ivaPercent = ivaNormalizado;
    } else if (obtenerIvaPorcentaje(prod) === ivaNormalizado) {
        prod.ivaPercent = IVA_PORCENTAJE_DEFAULT;
    }

    renderizarTabla();
    calcularTotales();
};

function calcularTotales() {
    const totalGeneral = productos.reduce((sum, prod) => sum + calcularValoresProducto(prod).totalMostrado, 0);
    document.getElementById("totalGeneral").innerText = formatoPeso(totalGeneral);
}

function actualizarSaludo() {
    const genero = document.getElementById("genero").value;
    const nombre = document.getElementById("cliente").value.trim();
    document.getElementById("saludoGenero").innerText = `${genero}:`;
    document.getElementById("nombreCliente").innerText = nombre;
}

function actualizarNombreVendedor() {
    const nombreVendedor = document.getElementById("nombreVendedor");
    const telefonoVendedor = document.getElementById("telefonoVendedor");

    if (!nombreVendedor) {
        return;
    }

    const vendedorSelect = document.getElementById("vendedor");
    const vendedorOtroInput = document.getElementById("vendedorOtro");
    const seleccionado = vendedorSelect ? vendedorSelect.value.trim() : "";
    const esOtro = seleccionado === "Otro";
    const nombreOtro = vendedorOtroInput ? vendedorOtroInput.value.trim() : "";
    const nombre = esOtro ? nombreOtro : seleccionado;
    nombreVendedor.innerText = nombre || "Alfombrando.";

    if (telefonoVendedor) {
        const telefono = seleccionado ? (VENDEDORES[seleccionado] || "") : "";
        telefonoVendedor.innerText = telefono;
    }
}

function actualizarNotaRapida() {
    const notaInput = document.getElementById("notaRapidaInput");
    const notaTexto = document.getElementById("notaRapidaTexto");
    const notaCard = document.getElementById("notaRapidaCard");

    if (!notaTexto) {
        return;
    }

    const texto = notaInput ? notaInput.value.trim() : "";
    const mostrarNota = notaConfirmada && texto.length > 0;

    if (notaCard) {
        notaCard.classList.toggle("d-none", !mostrarNota);
    }

    notaTexto.innerText = mostrarNota ? texto : "";
}
