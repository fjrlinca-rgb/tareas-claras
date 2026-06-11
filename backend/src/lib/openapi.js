// OpenAPI 3.0 spec for the HelpDesk backend.
// Served at /api/docs (Swagger UI) and /api/docs.json (raw spec).
export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "HelpDesk API",
    version: "1.1.0",
    description:
      "Backend self-hosted (Node.js + Express + PostgreSQL 17 + Socket.IO) que reemplaza a Supabase. " +
      "Autenticación con JWT en cookie HttpOnly (`hd_session`). " +
      "Realtime vía Socket.IO en `/socket.io`.",
  },
  servers: [
    { url: "/", description: "Same-origin (Nginx → backend)" },
    { url: "http://localhost:3001", description: "Local dev" },
  ],
  tags: [
    { name: "Auth" },
    { name: "Admin" },
    { name: "Resources", description: "CRUD genérico estilo PostgREST" },
    { name: "Uploads" },
    { name: "Health" },
  ],
  components: {
    securitySchemes: {
      cookieAuth: { type: "apiKey", in: "cookie", name: "hd_session" },
    },
    schemas: {
      Error: {
        type: "object",
        properties: { error: { type: "string" } },
        required: ["error"],
      },
      LoginRequest: {
        type: "object",
        required: ["usuario", "password"],
        properties: {
          usuario: { type: "string", example: "supervisor" },
          password: { type: "string", format: "password", example: "ChangeMe!123" },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          usuario: { type: "string" },
          nombre: { type: "string" },
          correo: { type: "string", format: "email" },
          rol: { type: "string", enum: ["cliente", "tecnico", "supervisor"] },
          activo: { type: "boolean" },
        },
      },
      CreateUserRequest: {
        type: "object",
        required: ["email", "password", "role"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 8 },
          role: { type: "string", enum: ["cliente", "tecnico", "supervisor"] },
          full_name: { type: "string" },
          username: { type: "string" },
          company_id: { type: "string", format: "uuid", nullable: true },
          active: { type: "boolean", default: true },
        },
      },
      CreateCompanyRequest: {
        type: "object",
        required: ["name", "email", "password"],
        properties: {
          name: { type: "string" },
          contact: { type: "string", nullable: true },
          email: { type: "string", format: "email" },
          username: { type: "string", nullable: true },
          password: { type: "string", minLength: 8 },
          active: { type: "boolean", default: true },
        },
      },
      Attachment: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          bucket: { type: "string" },
          path: { type: "string" },
          filename: { type: "string" },
          size: { type: "integer" },
          mime_type: { type: "string" },
          created_at: { type: "string", format: "date-time" },
        },
      },
    },
  },
  security: [{ cookieAuth: [] }],
  paths: {
    "/api/health": {
      get: {
        tags: ["Health"],
        security: [],
        summary: "Healthcheck",
        responses: { 200: { description: "OK" } },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        security: [],
        summary: "Login con usuario/correo y contraseña. Set-Cookie: hd_session.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } },
        },
        responses: {
          200: {
            description: "OK",
            content: { "application/json": { schema: { type: "object", properties: { user: { $ref: "#/components/schemas/User" } } } } },
          },
          401: { description: "Credenciales inválidas", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/auth/logout": {
      post: { tags: ["Auth"], summary: "Cierra la sesión y limpia la cookie.", responses: { 200: { description: "OK" } } },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Devuelve el usuario autenticado.",
        responses: {
          200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } },
          401: { description: "No autenticado" },
        },
      },
    },
    "/api/{resource}": {
      parameters: [
        {
          name: "resource", in: "path", required: true,
          schema: { type: "string", enum: [
            "tickets","ordenes","actividades","technicians","companies",
            "notifications","ticket_history","historial_ordenes","reportes_diarios","attachments",
          ] },
        },
      ],
      get: {
        tags: ["Resources"],
        summary: "Lista filas. Acepta filtros estilo PostgREST.",
        parameters: [
          { name: "order", in: "query", schema: { type: "string", example: "created_at.desc" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
          { name: "offset", in: "query", schema: { type: "integer" } },
        ],
        responses: { 200: { description: "Array de filas" } },
      },
      post: {
        tags: ["Resources"],
        summary: "Inserta una fila.",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { 200: { description: "Fila creada" } },
      },
    },
    "/api/{resource}/{id}": {
      parameters: [
        { name: "resource", in: "path", required: true, schema: { type: "string" } },
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      get:    { tags: ["Resources"], summary: "Detalle por id.", responses: { 200: { description: "Fila" }, 404: { description: "No existe" } } },
      patch:  { tags: ["Resources"], summary: "Actualización parcial.", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: { description: "Fila" } } },
      delete: { tags: ["Resources"], summary: "Elimina la fila.", responses: { 200: { description: "OK" } } },
    },
    "/api/admin/users": {
      post: {
        tags: ["Admin"], summary: "Crear usuario (solo supervisor).",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CreateUserRequest" } } } },
        responses: { 200: { description: "Creado" }, 403: { description: "Solo supervisores" } },
      },
    },
    "/api/admin/users/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      patch:  { tags: ["Admin"], summary: "Editar usuario (solo supervisor).", requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: { description: "OK" } } },
      delete: { tags: ["Admin"], summary: "Eliminar usuario (solo supervisor).", responses: { 200: { description: "OK" } } },
    },
    "/api/admin/companies": {
      post: {
        tags: ["Admin"], summary: "Crear empresa + usuario cliente (solo supervisor).",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CreateCompanyRequest" } } } },
        responses: { 200: { description: "Creado" } },
      },
    },
    "/api/uploads": {
      post: {
        tags: ["Uploads"],
        summary: "Sube un archivo (multipart/form-data).",
        requestBody: {
          required: true,
          content: { "multipart/form-data": { schema: { type: "object", properties: {
            file: { type: "string", format: "binary" },
            bucket: { type: "string" },
            ref_table: { type: "string" },
            ref_id: { type: "string" },
          }, required: ["file", "bucket"] } } },
        },
        responses: { 200: { description: "Attachment", content: { "application/json": { schema: { $ref: "#/components/schemas/Attachment" } } } } },
      },
    },
    "/api/uploads/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      get:    { tags: ["Uploads"], summary: "Descarga vía Nginx X-Accel-Redirect.", responses: { 200: { description: "Stream del archivo" } } },
      delete: { tags: ["Uploads"], summary: "Elimina el adjunto.", responses: { 200: { description: "OK" } } },
    },
  },
};
