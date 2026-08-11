// ==========================================
// CONFIGURACIÓN DE SUPABASE Y CIFRADO
// ==========================================

// 1. REEMPLAZA ESTO con los datos de tu proyecto de Supabase
// 1. REEMPLAZA ESTO con los datos de tu proyecto de Supabase
const SUPABASE_URL = 'https://dbdmwfkyhygtkqwrceia.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiZG13Zmt5aHlndGtxd3JjZWlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0MTIyMDQsImV4cCI6MjEwMTk4ODIwNH0.i0FC5-FuhSirAvVU2wN4f7nBcc-OVcCiuJN2AZtRUWY';

// 2. LLAVE DE CIFRADO AES (¡MANTENER EN SECRETO!)
// Esta llave se usa para cifrar y descifrar absolutamente todos los datos de la BD.
// Si pierdes esta llave, los datos en la base de datos serán irrecuperables.
const ENCRYPTION_KEY = 'SecretKey_SistemaDirectores_2027!';

// Inicializar Supabase (usaremos la variable global supabase que vendrá del CDN)
const dbClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Funciones globales de Cifrado usando CryptoJS
function encriptarDatos(objeto) {
    const jsonString = JSON.stringify(objeto);
    return CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();
}

function desencriptarDatos(textoCifrado) {
    try {
        const bytes = CryptoJS.AES.decrypt(textoCifrado, ENCRYPTION_KEY);
        const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
        return JSON.parse(decryptedString);
    } catch (e) {
        console.error("Error al descifrar los datos. ¿La llave es correcta?", e);
        return null;
    }
}
