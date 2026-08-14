-- El PDF de la cuenta de cobro vive en Drive; aqui solo queda el enlace.
ALTER TABLE "marketing_contenidos"
  ADD COLUMN "cuentaCobroUrl" TEXT,
  ADD COLUMN "cuentaCobroEn"  TIMESTAMP(3);
