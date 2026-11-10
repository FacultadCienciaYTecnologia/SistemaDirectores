// ==========================================
// LÓGICA PRINCIPAL (DASHBOARD)
// ==========================================

let allData = []; // Guardará los datos en texto plano en memoria temporal
let chartInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (!window.location.pathname.endsWith('index.html')) return;
    
    await cargarDatos();

    // Evento de búsqueda por texto
    document.getElementById('search-input').addEventListener('input', (e) => {
        renderizarTabla();
    });

    // Evento de búsqueda por distrito
    document.getElementById('filter-distrito').addEventListener('change', (e) => {
        renderizarTabla();
    });

    // Formulario de creación de usuario
    const formUsuario = document.getElementById('form-usuario');
    if(formUsuario) {
        formUsuario.addEventListener('submit', async (e) => {
            e.preventDefault();
            await crearUsuario();
        });
    }

    // Formulario de creación de centro escolar
    const formCentro = document.getElementById('form-centro');
    if (formCentro) {
        formCentro.addEventListener('submit', async (e) => {
            e.preventDefault();
            await registrarCentro();
        });
    }

    // Formulario de edición de centro escolar
    const formEditarCentro = document.getElementById('form-editar-centro');
    if (formEditarCentro) {
        formEditarCentro.addEventListener('submit', async (e) => {
            e.preventDefault();
            await editarCentro();
        });
    }

    // Formulario de edición de usuario
    const formEditarUsuario = document.getElementById('form-editar-usuario');
    if (formEditarUsuario) {
        formEditarUsuario.addEventListener('submit', async (e) => {
            e.preventDefault();
            await actualizarUsuario();
        });
    }

    // Inicializar navegación y usuarios si es admin
    const isAdmin = JSON.parse(sessionStorage.getItem('user_session'))?.rol === 'admin';
    if (isAdmin) {
        cargarUsuarios();
    }

    // Formulario de cambio de director
    document.getElementById('form-director').addEventListener('submit', async (e) => {
        e.preventDefault();
        await actualizarDirector();
    });
});

async function cargarDatos() {
    try {
        if (!dbClient) return;

        // 1. Obtener todas las escuelas cifradas
        const { data: escuelasCifradas, error: errEscuelas } = await dbClient
            .from('escuelas_cifradas')
            .select('*');
            
        if (errEscuelas) throw errEscuelas;

        // 2. Obtener todos los directores cifrados
        const { data: directoresCifrados, error: errDirectores } = await dbClient
            .from('directores_cifrados')
            .select('*');
            
        if (errDirectores) throw errDirectores;

        // 3. Descifrar y combinar datos en memoria
        allData = escuelasCifradas.map(esc => {
            const descifradoEscuela = desencriptarDatos(esc.datos_cifrados);
            
            // Encontrar todos los directores de esta escuela y descifrarlos
            const directores = directoresCifrados
                .filter(d => d.codigo_escuela === esc.codigo_infraestructura)
                .map(d => ({
                    id: d.id,
                    ...desencriptarDatos(d.datos_cifrados)
                }));

            // El director activo es el que tiene estado = 'Activo'
            const directorActivo = directores.find(d => d.estado === 'Activo');

            return {
                codigo_infraestructura: esc.codigo_infraestructura,
                nombre: descifradoEscuela?.nombre || 'Error Descifrado',
                distrito: descifradoEscuela?.distrito || 'Error Descifrado',
                directorActivo: directorActivo || null,
                historialDirectores: directores.sort((a,b) => new Date(b.fecha_inicio) - new Date(a.fecha_inicio))
            };
        });

        actualizarEstadisticas();
        renderizarTabla();
        renderizarGrafica();

    } catch (err) {
        console.error("Error cargando datos:", err);
        document.getElementById('table-body').innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--danger);">Error cargando datos. Verifica conexión o llave.</td></tr>`;
    }
}

function actualizarEstadisticas() {
    document.getElementById('stat-escuelas').textContent = allData.length;
    
    const distritosUnicos = Array.from(new Set(allData.map(d => d.distrito))).sort();
    document.getElementById('stat-distritos').textContent = distritosUnicos.length;
    
    // Llenar el select de distritos
    const selectDistrito = document.getElementById('filter-distrito');
    // Guardar la selección actual si hay
    const actual = selectDistrito.value;
    selectDistrito.innerHTML = '<option value="">Todos los Distritos</option>';
    distritosUnicos.forEach(distrito => {
        const option = document.createElement('option');
        option.value = distrito;
        option.textContent = distrito;
        selectDistrito.appendChild(option);
    });
    selectDistrito.value = actual;
    
    const directoresActivos = allData.filter(d => d.directorActivo).length;
    document.getElementById('stat-directores').textContent = directoresActivos;
}

function renderizarTabla() {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';
    
    const isAdmin = JSON.parse(sessionStorage.getItem('user_session'))?.rol === 'admin';

    const textoFiltro = document.getElementById('search-input').value.toLowerCase();
    const distritoFiltro = document.getElementById('filter-distrito').value;
    
    const filtrados = allData.filter(d => {
        const matchTexto = d.codigo_infraestructura.toString().includes(textoFiltro) ||
                           d.nombre.toLowerCase().includes(textoFiltro) ||
                           d.distrito.toLowerCase().includes(textoFiltro) ||
                           (d.directorActivo && d.directorActivo.nombre.toLowerCase().includes(textoFiltro));
        const matchDistrito = distritoFiltro === '' || d.distrito === distritoFiltro;
        return matchTexto && matchDistrito;
    });

    // Guardar para exportaciones
    datosFiltrados = filtrados;

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;">No se encontraron resultados</td></tr>`;
        return;
    }

    filtrados.forEach(d => {
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td>${d.codigo_infraestructura}</td>
            <td style="font-weight: 500;">${d.nombre}</td>
            <td>${d.distrito}</td>
            <td style="font-weight: 500;">${d.directorActivo ? d.directorActivo.nombre : '<span style="color:var(--danger)">Sin Asignar</span>'}</td>
            <td>${d.directorActivo ? d.directorActivo.dui : '-'}</td>
            <td>${d.directorActivo && d.directorActivo.telefono ? `<a href="tel:${d.directorActivo.telefono}" style="color: var(--accent); text-decoration: none;">${d.directorActivo.telefono}</a>` : '-'}</td>
            <td>${d.directorActivo && d.directorActivo.correo ? d.directorActivo.correo : '-'}</td>
            <td class="admin-only" style="text-align: right; display: ${isAdmin ? 'table-cell' : 'none'};">
                <button class="btn-secondary" style="padding: 4px 8px; font-size: 12px; margin-right: 4px;" onclick="abrirModalEditarCentro(${d.codigo_infraestructura})">Editar</button>
                <button class="btn-secondary" style="padding: 4px 8px; font-size: 12px; margin-right: 4px;" onclick="verHistorial(${d.codigo_infraestructura})">Historial</button>
                <button class="btn-primary" style="padding: 4px 8px; font-size: 12px; margin-right: 4px;" onclick="abrirModalCambioDirector(${d.codigo_infraestructura})">Cambiar Dir.</button>
                <button class="btn-secondary" style="padding: 4px 8px; font-size: 12px; background: rgba(239, 68, 68, 0.2); color: #ef4444; border-color: rgba(239, 68, 68, 0.4);" onclick="eliminarCentro(${d.codigo_infraestructura})">Eliminar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderizarGrafica() {
    const distritosCount = {};
    allData.forEach(d => {
        distritosCount[d.distrito] = (distritosCount[d.distrito] || 0) + 1;
    });

    const labels = Object.keys(distritosCount);
    const values = Object.values(distritosCount);

    const ctx = document.getElementById('distritosChart');
    if (chartInstance) chartInstance.destroy();
    
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Centros Escolares',
                data: values,
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            }
        }
    });
}

// ==========================================
// LÓGICA DE MODALES
// ==========================================

function abrirModalCambioDirector(codigoEscuela) {
    document.getElementById('dir-cod-escuela').value = codigoEscuela;
    
    // Obtener datos del director actual para pre-llenar las casillas
    const escuela = allData.find(d => d.codigo_infraestructura === codigoEscuela);
    if (escuela && escuela.directorActivo) {
        document.getElementById('dir-nombre').value = escuela.directorActivo.nombre || '';
        document.getElementById('dir-dui').value = escuela.directorActivo.dui || '';
        document.getElementById('dir-tel').value = escuela.directorActivo.telefono || '';
        document.getElementById('dir-correo').value = escuela.directorActivo.correo || '';
    } else {
        document.getElementById('form-director').reset();
        document.getElementById('dir-cod-escuela').value = codigoEscuela;
    }
    
    document.getElementById('modal-director').classList.add('active');
}

function abrirModalUsuario() {
    document.getElementById('form-usuario').reset();
    document.getElementById('modal-usuario').classList.add('active');
}

function abrirModalCentro() {
    document.getElementById('form-centro').reset();
    document.getElementById('modal-centro').classList.add('active');
}

function cerrarModal(id) {
    document.getElementById(id).classList.remove('active');
}

async function actualizarDirector() {
    const btnSave = document.getElementById('btn-save-director');
    btnSave.disabled = true;
    btnSave.textContent = 'Guardando...';

    const codEscuela = parseInt(document.getElementById('dir-cod-escuela').value);
    const nuevoNombre = document.getElementById('dir-nombre').value;
    const nuevoDUI = document.getElementById('dir-dui').value;
    const nuevoTel = document.getElementById('dir-tel').value;
    const nuevoCorreo = document.getElementById('dir-correo').value;
    const fechaHoy = new Date().toISOString().split('T')[0];

    try {
        const escuela = allData.find(e => e.codigo_infraestructura === codEscuela);
        if (escuela.directorActivo) {
            // 1. Desactivar director actual
            const directorViejo = { ...escuela.directorActivo };
            directorViejo.estado = 'Inactivo';
            directorViejo.fecha_fin = fechaHoy;
            
            const textoCifradoViejo = encriptarDatos(directorViejo);
            
            await dbClient
                .from('directores_cifrados')
                .update({ datos_cifrados: textoCifradoViejo })
                .eq('id', directorViejo.id);
        }

        // 2. Insertar nuevo director
        const nuevoDirector = {
            nombre: nuevoNombre,
            dui: nuevoDUI,
            telefono: nuevoTel,
            correo: nuevoCorreo,
            fecha_inicio: fechaHoy,
            fecha_fin: null,
            estado: 'Activo'
        };
        const textoCifradoNuevo = encriptarDatos(nuevoDirector);

        await dbClient
            .from('directores_cifrados')
            .insert([{
                codigo_escuela: codEscuela,
                datos_cifrados: textoCifradoNuevo
            }]);

        cerrarModal('modal-director');
        await cargarDatos(); // Recargar todo

    } catch (err) {
        console.error("Error al actualizar director:", err);
        Swal.fire('Error', 'Ocurrió un error. Revisa la consola.', 'error');
    } finally {
        btnSave.disabled = false;
        btnSave.textContent = 'Guardar Cambios';
    }
}

function verHistorial(codigoEscuela) {
    const escuela = allData.find(e => e.codigo_infraestructura === codigoEscuela);
    if (!escuela) return;

    const tbody = document.getElementById('historial-body');
    tbody.innerHTML = '';

    escuela.historialDirectores.forEach(dir => {
        const tr = document.createElement('tr');
        const activo = dir.estado === 'Activo';
        tr.innerHTML = `
            <td style="font-weight: 500;">${dir.nombre}</td>
            <td>${dir.dui}</td>
            <td>${dir.fecha_inicio}</td>
            <td>${dir.fecha_fin || '-'}</td>
            <td><span class="badge ${activo ? 'badge-active' : 'badge-inactive'}">${dir.estado}</span></td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('modal-historial').classList.add('active');
}

// ==========================================
// GESTIÓN DE USUARIOS Y NAVEGACIÓN
// ==========================================

function cambiarSeccion(seccionId) {
    // Actualizar nav items
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`nav-${seccionId}`).classList.add('active');
    
    // Actualizar secciones
    document.getElementById('seccion-centros').style.display = seccionId === 'centros' ? 'block' : 'none';
    document.getElementById('seccion-usuarios').style.display = seccionId === 'usuarios' ? 'block' : 'none';
}

async function cargarUsuarios() {
    const { data, error } = await dbClient.from('usuarios').select('id, username, rol');
    if (error) {
        console.error("Error cargando usuarios:", error);
        return;
    }
    
    const tbody = document.getElementById('usuarios-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    data.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.username}</td>
            <td><span class="badge ${user.rol === 'admin' ? 'badge-active' : 'badge-inactive'}">${user.rol.toUpperCase()}</span></td>
            <td style="text-align: right;">
                <button class="btn-secondary" style="padding: 4px 8px; font-size: 12px; margin-right: 4px;" onclick="abrirModalEditarUsuario('${user.id}', '${user.username}', '${user.rol}')">Editar</button>
                <button class="btn-secondary" style="padding: 4px 8px; font-size: 12px; background: rgba(239, 68, 68, 0.2); color: #ef4444; border-color: rgba(239, 68, 68, 0.4);" onclick="eliminarUsuario('${user.id}')">Eliminar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function crearUsuario() {
    const btnSave = document.getElementById('btn-save-usuario');
    btnSave.disabled = true;
    btnSave.textContent = 'Creando...';

    const username = document.getElementById('usr-username').value;
    const password = document.getElementById('usr-password').value;
    const rol = document.getElementById('usr-rol').value;

    try {
        const { data, error } = await dbClient.rpc('crear_usuario', {
            p_username: username,
            p_password: password,
            p_rol: rol
        });

        if (error) throw error;
        
        Swal.fire('Éxito', "Usuario creado exitosamente.", 'success');
        cerrarModal('modal-usuario');
        cargarUsuarios(); // Recargar tabla
    } catch (err) {
        console.error("Error al crear usuario:", err);
        Swal.fire('Error', "Error al crear usuario. Verifica en consola.", 'error');
    } finally {
        btnSave.disabled = false;
        btnSave.textContent = 'Crear Usuario';
    }
}

// ==========================================
// NUEVO CENTRO ESCOLAR
// ==========================================

async function registrarCentro() {
    const btnSave = document.getElementById('btn-save-centro');
    btnSave.disabled = true;
    btnSave.textContent = 'Registrando...';

    try {
        const codigo = parseInt(document.getElementById('nc-codigo').value);
        const nombre = document.getElementById('nc-nombre').value.trim();
        const distrito = document.getElementById('nc-distrito').value.trim();
        
        // Verificar si el código ya existe
        if (allData.find(d => d.codigo_infraestructura === codigo)) {
            Swal.fire('Error', "Ya existe un Centro Escolar con ese Código de Infraestructura.", 'error');
            return;
        }

        // Verificar si el nombre ya existe (Anti-duplicaciones)
        if (allData.find(d => d.nombre.toLowerCase() === nombre.toLowerCase())) {
            Swal.fire('Error', "Ya existe un Centro Escolar con ese Nombre exacto.", 'error');
            return;
        }

        // Datos del centro cifrados
        const datosCentro = { nombre, distrito };
        const centroCifrado = encriptarDatos(datosCentro);

        // 1. Insertar escuela
        const { error: errEscuela } = await dbClient.from('escuelas_cifradas').insert({
            codigo_infraestructura: codigo,
            datos_cifrados: centroCifrado
        });
        if (errEscuela) throw errEscuela;

        // 2. Insertar director
        const dirNombre = document.getElementById('nc-director').value;
        if (dirNombre) {
            const datosDirector = {
                nombre: dirNombre,
                dui: document.getElementById('nc-dui').value,
                telefono: document.getElementById('nc-telefono').value,
                correo: document.getElementById('nc-correo').value.trim(),
                fecha_inicio: new Date().toISOString().split('T')[0],
                fecha_fin: null,
                estado: 'Activo'
            };
            const directorCifrado = encriptarDatos(datosDirector);
            
            const { error: errDir } = await dbClient.from('directores_cifrados').insert({
                codigo_escuela: codigo,
                datos_cifrados: directorCifrado
            });
            if (errDir) throw errDir;
        }

        Swal.fire('Éxito', "Centro Escolar registrado exitosamente.", 'success');
        cerrarModal('modal-centro');
        await cargarDatos(); // Recargar todo
    } catch (error) {
        console.error("Error al registrar centro:", error);
        Swal.fire('Error', "Ocurrió un error al registrar el centro escolar.", 'error');
    } finally {
        btnSave.disabled = false;
        btnSave.textContent = 'Registrar Centro';
    }
}

// ==========================================
// EXPORTACIÓN DE DATOS
// ==========================================

function obtenerDatosFormateados() {
    const data = [];
    const marcaTemporal = new Date().toISOString();
    
    // Exportamos datosFiltrados en vez de allData
    datosFiltrados.forEach(escuela => {
        const dir = escuela.directorActivo;
        data.push({
            'Marca temporal': marcaTemporal,
            'CODIGO DE INFRAESTRUCTURA': escuela.codigo_infraestructura,
            'NOMBRE DEL CENTRO ESCOLAR': escuela.nombre,
            'DISTRITO GEOGRÁFICO': escuela.distrito,
            'DIRECTOR DEL CENTRO ESCOLAR': dir ? dir.nombre : '',
            'NUMERO DE DUI': dir ? dir.dui : '',
            'TELEFONO': dir ? dir.telefono : '',
            'CORREO ELECTRONICO INSTITUCIONAL': dir ? dir.correo : ''
        });
    });
    
    // Ordenar por distrito primero, luego por nombre
    return data.sort((a, b) => {
        if (a['DISTRITO GEOGRÁFICO'] < b['DISTRITO GEOGRÁFICO']) return -1;
        if (a['DISTRITO GEOGRÁFICO'] > b['DISTRITO GEOGRÁFICO']) return 1;
        if (a['NOMBRE DEL CENTRO ESCOLAR'] < b['NOMBRE DEL CENTRO ESCOLAR']) return -1;
        if (a['NOMBRE DEL CENTRO ESCOLAR'] > b['NOMBRE DEL CENTRO ESCOLAR']) return 1;
        return 0;
    });
}

function exportarExcel() {
    if (datosFiltrados.length === 0) return Swal.fire('Sin Datos', 'No hay datos para exportar.', 'warning');
    
    const data = obtenerDatosFormateados();
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Directores");
    
    XLSX.writeFile(workbook, "BaseDeDatos_Directores.xlsx");
}

function exportarPDF() {
    if (datosFiltrados.length === 0) return Swal.fire('Sin Datos', 'No hay datos para exportar.', 'warning');
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape'); // Horizontal para que quepan las columnas
    
    const data = obtenerDatosFormateados();
    
    const head = [[
        'Código', 
        'Centro Escolar', 
        'Distrito', 
        'Director', 
        'DUI', 
        'Teléfono', 
        'Correo'
    ]];
    
    const body = data.map(item => [
        item['CODIGO DE INFRAESTRUCTURA'],
        item['NOMBRE DEL CENTRO ESCOLAR'],
        item['DISTRITO GEOGRÁFICO'],
        item['DIRECTOR DEL CENTRO ESCOLAR'],
        item['NUMERO DE DUI'],
        item['TELEFONO'],
        item['CORREO ELECTRONICO INSTITUCIONAL']
    ]);

    doc.setFontSize(16);
    doc.text("Base de Datos - Sistema de Directores", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generado el: ${new Date().toLocaleString('es-ES')}`, 14, 22);
    
    doc.autoTable({
        head: head,
        body: body,
        startY: 28,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [15, 23, 42] } // Dark blue header
    });
    
    doc.save('BaseDeDatos_Directores.pdf');
}

function exportarWord() {
    if (datosFiltrados.length === 0) return Swal.fire('Sin Datos', 'No hay datos para exportar.', 'warning');
    
    const data = obtenerDatosFormateados();
    
    // Construimos una tabla HTML simple para que Word la interprete
    // Añadimos configuración de página para formato horizontal (Landscape)
    let html = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset='utf-8'>
            <title>Base de Datos Directores</title>
            <style>
                @page WordSection1 {
                    size: 841.9pt 595.3pt; /* A4 Landscape */
                    margin: 1.0in 1.0in 1.0in 1.0in;
                    mso-header-margin: .5in;
                    mso-footer-margin: .5in;
                    mso-paper-source: 0;
                }
                div.WordSection1 { page: WordSection1; }
            </style>
        </head>
        <body>
            <div class="WordSection1">
            <h2>Base de Datos - Sistema de Directores</h2>
            <p>Generado el: ${new Date().toLocaleString('es-ES')}</p>
            <table border="1" style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 12px;">
                <tr style="background-color: #f2f2f2;">
                    <th>Código</th>
                    <th>Centro Escolar</th>
                    <th>Distrito</th>
                    <th>Director</th>
                    <th>DUI</th>
                    <th>Teléfono</th>
                    <th>Correo</th>
                </tr>`;
                
    data.forEach(item => {
        html += `
                <tr>
                    <td>${item['CODIGO DE INFRAESTRUCTURA']}</td>
                    <td>${item['NOMBRE DEL CENTRO ESCOLAR']}</td>
                    <td>${item['DISTRITO GEOGRÁFICO']}</td>
                    <td>${item['DIRECTOR DEL CENTRO ESCOLAR']}</td>
                    <td>${item['NUMERO DE DUI']}</td>
                    <td>${item['TELEFONO']}</td>
                    <td>${item['CORREO ELECTRONICO INSTITUCIONAL']}</td>
                </tr>`;
    });
    
    html += `</table></div></body></html>`;
    
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    saveAs(blob, 'BaseDeDatos_Directores.doc');
}

// ==========================================
// EDICIÓN DE USUARIOS
// ==========================================
function abrirModalEditarUsuario(id, username, rol) {
    document.getElementById('edit-usr-id').value = id;
    document.getElementById('edit-usr-username').value = username;
    document.getElementById('edit-usr-rol').value = rol;
    document.getElementById('edit-usr-password').value = '';
    document.getElementById('modal-editar-usuario').classList.add('active');
}

async function actualizarUsuario() {
    const btnSave = document.getElementById('btn-update-usuario');
    btnSave.disabled = true;
    btnSave.textContent = 'Guardando...';

    const id = document.getElementById('edit-usr-id').value;
    const username = document.getElementById('edit-usr-username').value;
    const password = document.getElementById('edit-usr-password').value;
    const rol = document.getElementById('edit-usr-rol').value;

    try {
        const { error } = await dbClient.rpc('editar_usuario', {
            p_id: id,
            p_username: username,
            p_password: password,
            p_rol: rol
        });

        if (error) throw error;
        
        Swal.fire('Éxito', "Usuario actualizado exitosamente.", 'success');
        cerrarModal('modal-editar-usuario');
        cargarUsuarios();
    } catch (err) {
        console.error("Error al actualizar usuario:", err);
        Swal.fire('Error', "Error al actualizar usuario. Verifica en consola.", 'error');
    } finally {
        btnSave.disabled = false;
        btnSave.textContent = 'Guardar Cambios';
    }
}

async function eliminarUsuario(id) {
    const confirm1 = await Swal.fire({
        title: '¿Estás seguro?',
        text: '¿Estás seguro de eliminar este usuario permanentemente?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#374151',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });
    if (!confirm1.isConfirmed) return;

    try {
        const { error } = await dbClient.rpc('eliminar_usuario', { p_id: id });
        if (error) throw error;
        Swal.fire('Éxito', "Usuario eliminado correctamente.", 'success');
        cargarUsuarios();
    } catch (err) {
        console.error("Error al eliminar usuario:", err);
        Swal.fire('Error', "Error al eliminar usuario.", 'error');
    }
}

// ==========================================
// EDICIÓN DE CENTROS ESCOLARES
// ==========================================
function abrirModalEditarCentro(codigo) {
    const data = allData.find(d => d.codigo_infraestructura === codigo);
    if (!data) return;

    document.getElementById('edit-nc-codigo').value = codigo;
    document.getElementById('edit-nc-nombre').value = data.nombre;
    document.getElementById('edit-nc-distrito').value = data.distrito;
    
    const dir = data.directorActivo;
    document.getElementById('edit-nc-director').value = dir ? dir.nombre : '';
    document.getElementById('edit-nc-dui').value = dir ? dir.dui : '';
    document.getElementById('edit-nc-telefono').value = dir ? dir.telefono : '';
    document.getElementById('edit-nc-correo').value = dir ? (dir.correo || '') : '';

    document.getElementById('modal-editar-centro').classList.add('active');
}

async function editarCentro() {
    const btnSave = document.getElementById('btn-update-centro');
    btnSave.disabled = true;
    btnSave.textContent = 'Guardando...';

    try {
        const codigo = parseInt(document.getElementById('edit-nc-codigo').value);
        const nombre = document.getElementById('edit-nc-nombre').value;
        const distrito = document.getElementById('edit-nc-distrito').value;

        // 1. Actualizar escuela
        const datosCentro = { nombre, distrito };
        const centroCifrado = encriptarDatos(datosCentro);

        const { error: errEscuela } = await dbClient.from('escuelas_cifradas')
            .update({ datos_cifrados: centroCifrado })
            .eq('codigo_infraestructura', codigo);
            
        if (errEscuela) throw errEscuela;

        // 2. Actualizar director activo, o agregarlo si la escuela no tiene uno
        const dataOld = allData.find(d => d.codigo_infraestructura === codigo);
        const dirNombre = document.getElementById('edit-nc-director').value.trim();
        const dirDui = document.getElementById('edit-nc-dui').value;
        const dirTelefono = document.getElementById('edit-nc-telefono').value;
        const dirCorreo = document.getElementById('edit-nc-correo').value.trim();

        if (dataOld && dataOld.directorActivo) {
            const idDir = dataOld.directorActivo.id;
            const datosDirector = {
                nombre: dirNombre || dataOld.directorActivo.nombre,
                dui: dirDui,
                telefono: dirTelefono,
                correo: dirCorreo,
                fecha_inicio: dataOld.directorActivo.fecha_inicio,
                fecha_fin: dataOld.directorActivo.fecha_fin,
                estado: dataOld.directorActivo.estado
            };
            const directorCifrado = encriptarDatos(datosDirector);
            
            const { error: errDir } = await dbClient.from('directores_cifrados')
                .update({ datos_cifrados: directorCifrado })
                .eq('id', idDir);
                
            if (errDir) throw errDir;
        } else if (dirNombre) {
            const datosDirector = {
                nombre: dirNombre,
                dui: dirDui,
                telefono: dirTelefono,
                correo: dirCorreo,
                fecha_inicio: new Date().toISOString().split('T')[0],
                fecha_fin: null,
                estado: 'Activo'
            };
            const directorCifrado = encriptarDatos(datosDirector);

            const { error: errDir } = await dbClient.from('directores_cifrados').insert({
                codigo_escuela: codigo,
                datos_cifrados: directorCifrado
            });

            if (errDir) throw errDir;
        }

        Swal.fire('Éxito', "Centro Escolar actualizado exitosamente.", 'success');
        cerrarModal('modal-editar-centro');
        await cargarDatos();
    } catch (error) {
        console.error("Error al actualizar centro:", error);
        Swal.fire('Error', "Ocurrió un error al actualizar los datos.", 'error');
    } finally {
        btnSave.disabled = false;
        btnSave.textContent = 'Guardar Cambios';
    }
}

async function eliminarCentro(codigo) {
    const data = allData.find(d => d.codigo_infraestructura === codigo);
    if (!data) return;

    // Primera confirmación
    const confirm1 = await Swal.fire({
        title: 'ATENCIÓN',
        text: `Estás a punto de eliminar el centro escolar "${data.nombre}".\n\n¿Estás completamente seguro de continuar?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#374151',
        confirmButtonText: 'Sí, continuar',
        cancelButtonText: 'Cancelar'
    });
    
    if (!confirm1.isConfirmed) return;

    // Segunda confirmación
    const confirm2 = await Swal.fire({
        title: 'ADVERTENCIA FINAL',
        text: `Si eliminas este centro escolar, se borrará TODO su historial de directores de forma irreversible.\n\n¿Realmente deseas ELIMINAR el centro escolar con código ${codigo}?`,
        icon: 'error',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#374151',
        confirmButtonText: 'Eliminar DEFINITIVAMENTE',
        cancelButtonText: 'Cancelar'
    });

    if (!confirm2.isConfirmed) return;

    try {
        // Eliminar primero los directores asociados
        const { error: errDir } = await dbClient.from('directores_cifrados').delete().eq('codigo_escuela', codigo);
        if (errDir) throw errDir;

        // Eliminar el centro escolar
        const { error: errEscuela } = await dbClient.from('escuelas_cifradas').delete().eq('codigo_infraestructura', codigo);
        if (errEscuela) throw errEscuela;

        Swal.fire('Éxito', "Centro Escolar eliminado correctamente.", 'success');
        await cargarDatos();
    } catch (err) {
        console.error("Error al eliminar centro escolar:", err);
        Swal.fire('Error', "Ocurrió un error al intentar eliminar el centro escolar.", 'error');
    }
}

