// ==========================================
// LÓGICA DE AUTENTICACIÓN
// ==========================================

// Verificar sesión al cargar
document.addEventListener('DOMContentLoaded', () => {
    const isLoginPage = window.location.pathname.endsWith('login.html');
    const userSession = sessionStorage.getItem('user_session');

    if (!userSession && !isLoginPage) {
        // No hay sesión, redirigir a login
        window.location.href = 'login.html';
    } else if (userSession && isLoginPage) {
        // Ya hay sesión, redirigir al index
        window.location.href = 'index.html';
    }

    // Configurar evento de cierre de sesión si estamos en el dashboard
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            sessionStorage.removeItem('user_session');
            window.location.href = 'login.html';
        });
    }

    // Ocultar botones de admin si es lector
    if (userSession && !isLoginPage) {
        const user = JSON.parse(userSession);
        document.getElementById('user-name-display').textContent = user.username;
        if (user.rol === 'lector') {
            const adminElements = document.querySelectorAll('.admin-only');
            adminElements.forEach(el => el.style.display = 'none');
        }
    }
});

// Función para hacer login (llamada desde login.html)
async function login(username, password) {
    try {
        const { data, error } = await dbClient.rpc('verificar_login', {
            p_username: username,
            p_password: password
        });

        if (error) throw error;

        if (data && data.success) {
            // Guardar sesión en sessionStorage (se borra al cerrar la pestaña)
            sessionStorage.setItem('user_session', JSON.stringify({
                id: data.id,
                username: data.username,
                rol: data.rol
            }));
            window.location.href = 'index.html';
        } else {
            return { success: false, message: 'Usuario o contraseña incorrectos' };
        }
    } catch (err) {
        console.error("Error en login:", err);
        return { success: false, message: 'Error de conexión con el servidor.' };
    }
}
