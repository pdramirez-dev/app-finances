# Seguridad de datos bancarios

## Política actual

El API solo acepta y devuelve identificadores bancarios previamente enmascarados. Los campos
`accountNumberMasked`, `routingNumberMasked` e `ibanMasked` deben contener caracteres de máscara
(`*`, `x` o `•`) y exponer como máximo los últimos cuatro caracteres (seis para conservar el prefijo
de país de un IBAN). Un número completo es rechazado por el resolver antes de llegar a PostgreSQL.

Aurora cifra el almacenamiento y sus snapshots. El tráfico usa TLS mediante AppSync y RDS Data API.
Los valores bancarios enmascarados quedan aislados por `accountId`, requieren una membresía `ACTIVE`
y los cambios se registran en `audit-log`.

## Si el producto necesita almacenar el valor completo

No se añadirá el valor completo al schema GraphQL ni a logs. Se usará cifrado de sobre en una Lambda
dedicada:

1. La Lambda valida membresía y rol `OWNER` o `ADMIN`.
2. AWS KMS genera una data key con contexto de cifrado `{stage, accountId, bankAccountId}`.
3. Solo se persisten el ciphertext y la data key cifrada; el plaintext vive únicamente en memoria.
4. Las respuestas continúan exponiendo exclusivamente la versión enmascarada.
5. La clave KMS tendrá rotación, permisos mínimos y alarmas para intentos de descifrado fallidos.

El backfill nunca debe copiar números completos desde DynamoDB. Si encuentra datos sin máscara, debe
detenerse para una revisión manual y no persistirlos.
