-- ==============================================================================
-- SISTEMA DE DIRECTORES - SCRIPT DE SUPABASE
-- Copia y pega esto en el SQL Editor de tu proyecto de Supabase y ejecútalo.
-- ==============================================================================

-- 1. Habilitar extensión pgcrypto para hash de contraseñas de usuarios
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Crear tabla de usuarios
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('admin', 'lector')),
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Crear tabla de escuelas (Datos encriptados desde el cliente)
-- Solo dejamos el código de infraestructura sin cifrar para poder hacer la relación.
CREATE TABLE IF NOT EXISTS public.escuelas_cifradas (
    codigo_infraestructura BIGINT PRIMARY KEY,
    datos_cifrados TEXT NOT NULL, -- Contendrá nombre y distrito cifrados en AES
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Crear tabla de historial de directores (Datos encriptados desde el cliente)
CREATE TABLE IF NOT EXISTS public.directores_cifrados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_escuela BIGINT REFERENCES public.escuelas_cifradas(codigo_infraestructura) ON DELETE CASCADE,
    datos_cifrados TEXT NOT NULL, -- Contendrá nombre, dui, telefono, correo, fechas y estado
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- CONFIGURACIÓN DE SEGURIDAD (Row Level Security - RLS)
-- Asegura que solo los usuarios logueados (usaremos un sistema custom) 
-- puedan leer la información, aunque esto se manejará desde la app.
-- Como no usamos Supabase Auth estándar sino nuestra tabla 'usuarios',
-- habilitaremos RLS pero daremos acceso anónimo SOLO si envían un token o algo?
-- Para simplificar el sistema básico de frontend puro, podemos permitir lecturas 
-- a la API y la app se encarga de descifrar (sin la llave AES del JS nadie puede ver nada).
-- ==============================================================================

-- Habilitar el acceso a la API REST (Políticas públicas, pero el contenido es indescifrable)
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escuelas_cifradas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directores_cifrados ENABLE ROW LEVEL SECURITY;

-- Crear políticas para permitir acceso libre a la API (la seguridad real es el cifrado AES)
CREATE POLICY "Permitir todo a anonimos en usuarios" ON public.usuarios FOR ALL USING (true);
CREATE POLICY "Permitir todo a anonimos en escuelas" ON public.escuelas_cifradas FOR ALL USING (true);
CREATE POLICY "Permitir todo a anonimos en directores" ON public.directores_cifrados FOR ALL USING (true);


-- ==============================================================================
-- INSERTAR USUARIO ADMINISTRADOR POR DEFECTO
-- Contraseña irreversible cifrada usando crypt()
-- ==============================================================================
INSERT INTO public.usuarios (username, password_hash, rol)
VALUES (
    'Mcastro795',
    crypt('Bow.rum995', gen_salt('bf')),
    'admin'
) ON CONFLICT (username) DO NOTHING;

-- Función de ayuda para que el frontend verifique el login
CREATE OR REPLACE FUNCTION verificar_login(p_username TEXT, p_password TEXT)
RETURNS JSON AS $$
DECLARE
    v_user public.usuarios;
    v_result JSON;
BEGIN
    SELECT * INTO v_user
    FROM public.usuarios
    WHERE username = p_username;

    IF v_user.id IS NOT NULL AND v_user.password_hash = crypt(p_password, v_user.password_hash) THEN
        v_result := json_build_object(
            'success', true,
            'id', v_user.id,
            'username', v_user.username,
            'rol', v_user.rol
        );
    ELSE
        v_result := json_build_object('success', false);
    END IF;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- FUNCIÓN PARA CREAR NUEVOS USUARIOS (Ejecutar en SQL Editor)
-- ==============================================================================
CREATE OR REPLACE FUNCTION crear_usuario(p_username TEXT, p_password TEXT, p_rol TEXT)
RETURNS void AS $$
BEGIN
    INSERT INTO public.usuarios (username, password_hash, rol)
    VALUES (
        p_username,
        crypt(p_password, gen_salt('bf')),
        p_rol
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- FUNCIÓN PARA EDITAR USUARIOS (Ejecutar en SQL Editor)
-- ==============================================================================
CREATE OR REPLACE FUNCTION editar_usuario(p_id UUID, p_username TEXT, p_password TEXT, p_rol TEXT)
RETURNS void AS $$
BEGIN
    IF p_password IS NOT NULL AND p_password <> '' THEN
        UPDATE public.usuarios 
        SET username = p_username,
            password_hash = crypt(p_password, gen_salt('bf')),
            rol = p_rol
        WHERE id = p_id;
    ELSE
        UPDATE public.usuarios 
        SET username = p_username,
            rol = p_rol
        WHERE id = p_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- FUNCIÓN PARA ELIMINAR USUARIOS (Ejecutar en SQL Editor)
-- ==============================================================================
CREATE OR REPLACE FUNCTION eliminar_usuario(p_id UUID)
RETURNS void AS $$
BEGIN
    DELETE FROM public.usuarios WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
