-- Created with the tenancy work and never used: invitations go out as
-- password-reset tokens, both for employees and for the administrator of a
-- company set up from the back office. A schema that describes something the
-- application does not do is worse than an incomplete one.
DROP TABLE "invitations" CASCADE;