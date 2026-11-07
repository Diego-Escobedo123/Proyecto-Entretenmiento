# Backups de la base de datos (RDS)

La base de producción es la instancia **`testd-db`** de Amazon RDS
(PostgreSQL 18, `db.t4g.micro`, región **us-east-2 / Ohio**). La base de la
app dentro de ella se llama `mosaic`.

## Qué está configurado

| Qué | Valor |
| --- | --- |
| Backups automáticos | Activados, uno por día |
| Retención | **1 día** (el máximo que permite el plan gratuito de AWS) |
| Ventana de backup | 03:08 UTC, 30 min (21:08 hora de Guatemala) |
| Restauración a un momento dado | Cualquier momento dentro del último día, con unos 5 min de diferencia |
| Protección contra eliminación | Activada |

Con 1 día de retención sólo se puede volver hasta ayer. Antes de algo
riesgoso (una migración grande, borrar datos a mano) conviene sacar una
**instantánea manual**, que no vence: se guarda hasta que alguien la borre.

## Verificar que hay backups

En la consola de AWS, región Ohio:

- **Aurora and RDS → Copias de seguridad automatizadas**: aparece `testd-db`
  con su "Hora de restauración más temprana" y "más reciente".
- **Aurora and RDS → Instantáneas → pestaña Sistema**: el snapshot diario
  (`rds:testd-db-AAAA-MM-DD-HH-MM`).

## Sacar una instantánea manual

1. **Aurora and RDS → Bases de datos → `testd-db` → Acciones → Tomar instantánea**.
2. Nombre: `mosaic-antes-de-<qué>-AAAA-MM-DD`.
3. Queda en **Instantáneas → pestaña Manual**. Ocupa espacio y gasta
   créditos: borrarla cuando ya no haga falta.

## Restaurar

RDS **nunca sobrescribe** la instancia original: restaurar crea una
instancia nueva con los datos de ese momento. Después se apunta la app a la
nueva y se borra la vieja.

1. **Aurora and RDS → Bases de datos → `testd-db` → Acciones →
   Restaurar a un momento dado.**
   (Desde una instantánea manual: **Instantáneas → elegirla → Acciones →
   Restaurar instantánea**; el resto es igual.)
2. Momento: **Hora de restauración más reciente**, o una fecha y hora
   personalizada anterior al problema.
3. Configurar la instancia nueva igual que la original:
   - Identificador: `testd-db-restaurada`
   - Clase: `db.t4g.micro`, **sin** Multi-AZ
   - Conectividad: misma VPC, **Accesible públicamente: Sí**, grupo de
     seguridad **`mosaic-db-sg`**
4. **Restaurar** y esperar a que quede *Disponible* (unos 10–20 min).
5. Copiar el **punto de conexión** de la instancia nueva y cambiar sólo el
   host en `DATABASE_URL` (usuario, contraseña y base `mosaic` son los mismos
   de la original):

   ```env
   DATABASE_URL="postgresql://postgres:<contraseña>@<endpoint-nuevo>:5432/mosaic?schema=public&sslmode=require"
   ```

6. Comprobar desde `backend/`:

   ```bash
   bunx prisma migrate status   # "Database schema is up to date!"
   ```

   y entrar a la app para ver que los datos son los esperados.
7. Cuando todo esté bien, borrar la instancia que ya no se usa para no pagar
   dos: **Modificar → desmarcar Protección contra eliminación → Aplicar
   inmediatamente**, y luego **Acciones → Eliminar**.

## Copia portátil con `pg_dump` (opcional)

Un archivo `.sql` que se puede guardar fuera de AWS o cargar en una Postgres
local. Necesita Docker y que tu IP esté en `mosaic-db-sg`. La imagen tiene
que ser `postgres:18` o mayor (`pg_dump` no exporta servidores más nuevos que
él):

```bash
docker run --rm postgres:18 pg_dump "postgresql://postgres:<contraseña>@<endpoint>:5432/mosaic?sslmode=require" > mosaic.sql
```

El archivo contiene datos de usuarios: no subirlo al repo.
