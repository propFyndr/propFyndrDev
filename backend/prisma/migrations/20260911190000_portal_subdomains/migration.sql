-- Tenant portal subdomains.
--
-- `lotus.propfyndr.in` serves that builder's console instead of a path nobody
-- remembers. Addressing only — never authorisation. Every portal endpoint
-- still derives its scope from the session, so a tenant who opens someone
-- else's subdomain sees their own console, not that tenant's data.
--
-- UNIQUE because two tenants cannot answer on one host. Nullable because most
-- rows will never have one, and a tenant clearing theirs is a valid edit.
--
-- Validation (reserved words, DNS label rules) lives in
-- backend/src/lib/portalSubdomain.ts and is applied on every write path.

-- AlterTable
ALTER TABLE "builders" ADD COLUMN     "portal_subdomain" TEXT;

-- AlterTable
ALTER TABLE "channel_partners" ADD COLUMN     "portal_subdomain" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "builders_portal_subdomain_key" ON "builders"("portal_subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "channel_partners_portal_subdomain_key" ON "channel_partners"("portal_subdomain");
