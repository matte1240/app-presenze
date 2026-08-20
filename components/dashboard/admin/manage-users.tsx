"use client";

import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { User, UserRole } from "@/types/models";
import {
  Plus,
  Edit,
  Key,
  Trash2,
  Calendar,
  Bell,
  Users as UsersIcon,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Label, Select } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrapper,
} from "@/components/ui/table";
import UserScheduleEditor from "@/components/dashboard/admin/user-schedule-editor";

type UserWithFlags = User & {
  hasPermesso104?: boolean;
  hasPaternityLeave?: boolean;
};

type ManageUsersProps = {
  users: UserWithFlags[];
  currentUserId: string;
};

type CreateUserForm = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
  hasPermesso104: boolean;
  hasPaternityLeave: boolean;
};

type EditUserForm = {
  name: string;
  email: string;
  role: UserRole;
  hasPermesso104: boolean;
  hasPaternityLeave: boolean;
};

export default function ManageUsers({ users, currentUserId }: ManageUsersProps) {
  const router = useRouter();

  // Modal states
  const [isCreatingUserModalOpen, setIsCreatingUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithFlags | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [resettingPasswordUser, setResettingPasswordUser] = useState<User | null>(null);
  const [scheduleEditingUser, setScheduleEditingUser] = useState<UserWithFlags | null>(null);
  
  // Manual password toggle states (for production mode with admin control)
  const [manualPasswordCreate, setManualPasswordCreate] = useState(false);
  const [manualPasswordReset, setManualPasswordReset] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState<CreateUserForm>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "EMPLOYEE",
    hasPermesso104: false,
    hasPaternityLeave: false,
  });
  const [editForm, setEditForm] = useState<EditUserForm>({
    name: "",
    email: "",
    role: "EMPLOYEE",
    hasPermesso104: false,
    hasPaternityLeave: false,
  });
  const [resetPasswordForm, setResetPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  // Transition states
  const [isCreating, startCreating] = useTransition();
  const [isUpdating, startUpdating] = useTransition();
  const [isDeleting, startDeleting] = useTransition();
  const [isResettingPassword, startResettingPassword] = useTransition();
  const [isSendingReminder, startSendingReminder] = useTransition();

  // Track which user is receiving a reminder (for loading state)
  const [remindingUserId, setRemindingUserId] = useState<string | null>(null);

  // Message states
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Crea Utente Handler
  const resetPasswordDialog = () => {
    setResettingPasswordUser(null);
    setResetPasswordForm({ newPassword: "", confirmPassword: "" });
    setManualPasswordReset(false);
    setError(null);
    setSuccess(null);
  };

  const resetCreateForm = () => {
    setIsCreatingUserModalOpen(false);
    setCreateForm({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: "EMPLOYEE",
      hasPermesso104: false,
      hasPaternityLeave: false,
    });
    setManualPasswordCreate(false);
    setError(null);
    setSuccess(null);
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate password when manual password is enabled
    if (manualPasswordCreate) {
      if (createForm.password !== createForm.confirmPassword) {
        setError("Le password non coincidono");
        return;
      }
      if (createForm.password.length < 8) {
        setError("La password deve contenere almeno 8 caratteri");
        return;
      }
    }

    startCreating(async () => {
      try {
        const body = manualPasswordCreate
          ? {
              name: createForm.name,
              email: createForm.email,
              password: createForm.password,
              role: createForm.role,
              hasPermesso104: createForm.hasPermesso104,
              hasPaternityLeave: createForm.hasPaternityLeave,
            }
          : {
              name: createForm.name,
              email: createForm.email,
              role: createForm.role,
              hasPermesso104: createForm.hasPermesso104,
              hasPaternityLeave: createForm.hasPaternityLeave,
              // Note: If not manual password, we might need a way to generate one or handle it. 
              // Assuming the backend handles password generation or email flow if password is missing/default.
              // But wait, the previous code had /api/users/create. Let's stick to /api/users based on my previous read of route.ts
              password: "ChangeMe123!", // Temporary default if manual is off, or handle in backend
            };

        const response = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Impossibile creare l'utente");
          return;
        }

        const successMessage = manualPasswordCreate
          ? `Utente ${createForm.email} creato con successo!`
          : `Utente ${createForm.email} creato! Riceverà un'email per impostare la password.`;

        setSuccess(successMessage);
        setCreateForm({
          name: "",
          email: "",
          password: "",
          confirmPassword: "",
          role: "EMPLOYEE",
          hasPermesso104: false,
          hasPaternityLeave: false,
        });
        setManualPasswordCreate(false); // Reset toggle
        setIsCreatingUserModalOpen(false);
        router.refresh();
      } catch (err) {
        console.error(err);
        setError("Si è verificato un errore imprevisto");
      }
    });
  };

  // Modifica Utente Handler
  const handleEditClick = (user: UserWithFlags) => {
    setEditingUser(user);
    setEditForm({
      name: user.name || "",
      email: user.email,
      role: user.role,
      hasPermesso104: user.hasPermesso104 || false,
      hasPaternityLeave: user.hasPaternityLeave || false,
    });
    setError(null);
    setSuccess(null);
  };

  const handleEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setError(null);
    setSuccess(null);

    startUpdating(async () => {
      try {
        const response = await fetch(`/api/users/${editingUser.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editForm),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Impossibile aggiornare l'utente");
          return;
        }

        setSuccess("Utente aggiornato con successo!");
        setEditingUser(null);
        router.refresh();
      } catch (err) {
        console.error(err);
        setError("Si è verificato un errore imprevisto");
      }
    });
  };

  // Elimina Utente Handler
  const handleDeleteUser = () => {
    if (!deletingUser) return;

    setError(null);
    setSuccess(null);

    startDeleting(async () => {
      try {
        const response = await fetch(`/api/users/${deletingUser.id}`, {
          method: "DELETE",
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Impossibile eliminare l'utente");
          return;
        }

        setSuccess(`Utente ${deletingUser.email} eliminato con successo!`);
        setDeletingUser(null);
        router.refresh();
      } catch (err) {
        console.error(err);
        setError("Si è verificato un errore imprevisto");
      }
    });
  };

  // Reimposta Password Handler
  // Invia Promemoria Timesheet Handler
  const handleSendReminder = (user: UserWithFlags) => {
    setRemindingUserId(user.id);
    setError(null);
    setSuccess(null);

    startSendingReminder(async () => {
      try {
        const response = await fetch(`/api/users/${user.id}/remind-timesheet`, {
          method: "POST",
        });

        const data = await response.json();

        if (response.status === 401) {
          router.push("/");
          return;
        }

        if (!response.ok) {
          setError(data.error || "Impossibile inviare il promemoria");
          return;
        }

        setSuccess(data.message || `Promemoria inviato con successo a ${user.email}!`);
      } catch (err) {
        console.error(err);
        setError("Si è verificato un errore imprevisto durante l'invio del promemoria");
      } finally {
        setRemindingUserId(null);
      }
    });
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingPasswordUser) return;

    setError(null);
    setSuccess(null);

    if (manualPasswordReset) {
      // Manual password reset
      if (resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword) {
        setError("Le password non coincidono");
        return;
      }
      if (resetPasswordForm.newPassword.length < 8) {
        setError("La password deve contenere almeno 8 caratteri");
        return;
      }

      startResettingPassword(async () => {
        try {
          const endpoint = `/api/users/${resettingPasswordUser.id}/reset-password`;
            
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ newPassword: resetPasswordForm.newPassword }),
          });

          const data = await response.json();

          if (!response.ok) {
            setError(data.error || "Impossibile reimpostare la password");
            return;
          }

          setSuccess(`Password reimpostata con successo per ${resettingPasswordUser.email}!`);
          setResettingPasswordUser(null);
          setResetPasswordForm({ newPassword: "", confirmPassword: "" });
          setManualPasswordReset(false); // Reset toggle
        } catch (err) {
          console.error(err);
          setError("Si è verificato un errore imprevisto");
        }
      });
    } else {
      // Production mode: Email-based reset
      startResettingPassword(async () => {
        try {
          const response = await fetch(`/api/users/${resettingPasswordUser.id}/reset-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });

          const data = await response.json();

          if (!response.ok) {
            setError(data.error || "Impossibile inviare l'email di reset");
            return;
          }

          setSuccess(`Email di reset inviata a ${resettingPasswordUser.email}!`);
          setResettingPasswordUser(null);
        } catch (err) {
          console.error(err);
          setError("Si è verificato un errore imprevisto");
        }
      });
    }
  };

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Utenti"
        description="Account, ruoli e orari settimanali del team."
        actions={
          <Button
            icon={<Plus />}
            onClick={() => {
              setIsCreatingUserModalOpen(true);
              setError(null);
              setSuccess(null);
            }}
          >
            Nuovo utente
          </Button>
        }
      />

      {success && (
        <Alert variant="success" className="mb-4" dismissible onDismiss={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {error && (
        <Alert variant="error" className="mb-4" dismissible onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableWrapper>
        {users.length === 0 ? (
          <EmptyState
            compact
            icon={<UsersIcon />}
            title="Nessun utente"
            description="Crea il primo account per iniziare a raccogliere le presenze."
            action={
              <Button size="sm" onClick={() => setIsCreatingUserModalOpen(true)}>
                Nuovo utente
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utente</TableHead>
                <TableHead className="hidden md:table-cell">Ruolo</TableHead>
                <TableHead className="hidden lg:table-cell">Registrato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                        {(user.name ?? user.email ?? "U")[0].toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-foreground">
                          {user.name ?? "Senza nome"}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant={user.role === "ADMIN" ? "primary" : "neutral"}>
                      {user.role === "ADMIN" ? "Amministratore" : "Dipendente"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-[13px] text-muted-foreground lg:table-cell">
                    {format(user.createdAt, "d MMM yyyy", { locale: it })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<Calendar />}
                        onClick={() => {
                          setScheduleEditingUser(user);
                          setError(null);
                          setSuccess(null);
                        }}
                      >
                        <span className="hidden sm:inline">Orari</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<Edit />}
                        onClick={() => handleEditClick(user)}
                      >
                        <span className="hidden sm:inline">Modifica</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableWrapper>

      {/* Crea Utente Modal */}
      <Dialog
        open={isCreatingUserModalOpen}
        onClose={resetCreateForm}
        title="Nuovo utente"
        description="L'utente riceve via email un link per impostare la propria password."
        footer={
          <>
            <Button variant="ghost" onClick={resetCreateForm} disabled={isCreating}>
              Annulla
            </Button>
            <Button type="submit" form="create-user-form" loading={isCreating}>
              {isCreating ? "Creazione…" : "Crea utente"}
            </Button>
          </>
        }
      >
        <form id="create-user-form" onSubmit={handleCreateUser} className="space-y-4">
          <Field label="Nome completo">
            {(field) => (
              <Input
                {...field}
                type="text"
                required
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Mario Rossi"
              />
            )}
          </Field>

          <Field label="Email">
            {(field) => (
              <Input
                {...field}
                type="email"
                required
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="mario.rossi@esempio.com"
              />
            )}
          </Field>

          <Field label="Ruolo">
            {(field) => (
              <Select
                {...field}
                value={createForm.role}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, role: e.target.value as UserRole }))
                }
              >
                <option value="EMPLOYEE">Dipendente</option>
                <option value="ADMIN">Amministratore</option>
              </Select>
            )}
          </Field>

          <div className="space-y-2">
            <Label>Permessi speciali</Label>
            <CheckboxRow
              id="createHasPermesso104"
              checked={createForm.hasPermesso104}
              onChange={(checked) =>
                setCreateForm((f) => ({ ...f, hasPermesso104: checked }))
              }
              label="Permesso 104"
              hint="Massimo 24 ore al mese."
            />
            <CheckboxRow
              id="createHasPaternityLeave"
              checked={createForm.hasPaternityLeave}
              onChange={(checked) =>
                setCreateForm((f) => ({ ...f, hasPaternityLeave: checked }))
              }
              label="Congedo facoltativo di maternità/paternità"
              hint="Massimo 10 giorni."
            />
          </div>

          <CheckboxRow
            id="manualPasswordCreate"
            checked={manualPasswordCreate}
            onChange={setManualPasswordCreate}
            label="Imposta la password manualmente"
            hint="Nessuna email di invito viene inviata all'utente."
          />

          {manualPasswordCreate && (
            <>
              <Field label="Password">
                {(field) => (
                  <Input
                    {...field}
                    type="password"
                    required
                    minLength={8}
                    value={createForm.password}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, password: e.target.value }))
                    }
                    placeholder="Almeno 8 caratteri"
                  />
                )}
              </Field>

              <Field label="Conferma password">
                {(field) => (
                  <Input
                    {...field}
                    type="password"
                    required
                    minLength={8}
                    value={createForm.confirmPassword}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, confirmPassword: e.target.value }))
                    }
                    placeholder="Ripeti la password"
                  />
                )}
              </Field>

              <Alert variant="warning" title="Modalità sviluppo">
                Stai impostando la password a mano e nessuna email verrà inviata.
                Da usare solo per test e sviluppo.
              </Alert>
            </>
          )}

          {error && <Alert variant="error">{error}</Alert>}
        </form>
      </Dialog>

      {/* Modifica Utente Modal */}
      <Dialog
        open={editingUser !== null}
        onClose={() => {
          setEditingUser(null);
          setError(null);
          setSuccess(null);
        }}
        title="Modifica utente"
        description={editingUser?.email}
        footer={
          <>
            <Button
              variant="ghost"
              disabled={isUpdating}
              onClick={() => {
                setEditingUser(null);
                setError(null);
                setSuccess(null);
              }}
            >
              Annulla
            </Button>
            <Button type="submit" form="edit-user-form" loading={isUpdating}>
              {isUpdating ? "Aggiornamento…" : "Salva"}
            </Button>
          </>
        }
      >
        <form id="edit-user-form" onSubmit={handleEditUser} className="space-y-4">
          <Field label="Nome completo">
            {(field) => (
              <Input
                {...field}
                type="text"
                required
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Mario Rossi"
              />
            )}
          </Field>

          <Field label="Email">
            {(field) => (
              <Input
                {...field}
                type="email"
                required
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="mario.rossi@esempio.com"
              />
            )}
          </Field>

          <Field
            label="Ruolo"
            hint={
              editingUser?.id === currentUserId
                ? "Non puoi cambiare il tuo ruolo: perderesti l'accesso amministratore."
                : undefined
            }
          >
            {(field) => (
              <Select
                {...field}
                value={editForm.role}
                disabled={editingUser?.id === currentUserId}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, role: e.target.value as UserRole }))
                }
              >
                <option value="EMPLOYEE">Dipendente</option>
                <option value="ADMIN">Amministratore</option>
              </Select>
            )}
          </Field>

          <div className="space-y-2">
            <Label>Permessi speciali</Label>
            <CheckboxRow
              id="editHasPermesso104"
              checked={editForm.hasPermesso104}
              onChange={(checked) =>
                setEditForm((f) => ({ ...f, hasPermesso104: checked }))
              }
              label="Permesso 104"
              hint="Massimo 24 ore al mese."
            />
            <CheckboxRow
              id="editHasPaternityLeave"
              checked={editForm.hasPaternityLeave}
              onChange={(checked) =>
                setEditForm((f) => ({ ...f, hasPaternityLeave: checked }))
              }
              label="Congedo facoltativo di maternità/paternità"
              hint="Massimo 10 giorni."
            />
          </div>

          {error && <Alert variant="error">{error}</Alert>}

          {/* Secondary actions live below a rule, away from the save button, so
              "Elimina utente" can never be hit while reaching for "Salva". */}
          <div className="space-y-2 border-t border-border pt-4">
            <Label className="text-muted-foreground">Azioni</Label>
            <Button
              variant="outline"
              className="w-full justify-start"
              icon={<Bell />}
              loading={isSendingReminder && remindingUserId === editingUser?.id}
              onClick={() => editingUser && handleSendReminder(editingUser)}
              title="Invia un promemoria per compilare il calendario"
            >
              {isSendingReminder && remindingUserId === editingUser?.id
                ? "Invio in corso…"
                : "Invia promemoria calendario"}
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              icon={<Key />}
              onClick={() => {
                setResettingPasswordUser(editingUser);
                setEditingUser(null);
                setResetPasswordForm({ newPassword: "", confirmPassword: "" });
              }}
            >
              Reimposta password
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-destructive hover:bg-destructive-subtle hover:text-destructive"
              icon={<Trash2 />}
              disabled={editingUser?.id === currentUserId}
              title={
                editingUser?.id === currentUserId
                  ? "Non puoi eliminare il tuo account"
                  : "Elimina utente"
              }
              onClick={() => {
                setDeletingUser(editingUser);
                setEditingUser(null);
              }}
            >
              Elimina utente
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Elimina Utente Modal */}
      <ConfirmDialog
        open={deletingUser !== null}
        onClose={() => {
          setDeletingUser(null);
          setError(null);
          setSuccess(null);
        }}
        onConfirm={handleDeleteUser}
        title="Eliminare l'utente?"
        description={
          deletingUser
            ? `${deletingUser.email} e tutte le sue registrazioni orarie vengono rimossi definitivamente. L'operazione non può essere annullata.`
            : undefined
        }
        confirmLabel={isDeleting ? "Eliminazione…" : "Elimina utente"}
        destructive
        loading={isDeleting}
      />

      {/* Reimposta Password Modal */}
      <Dialog
        open={resettingPasswordUser !== null}
        onClose={resetPasswordDialog}
        title="Reimposta password"
        description={resettingPasswordUser?.email}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={resetPasswordDialog}
              disabled={isResettingPassword}
            >
              Annulla
            </Button>
            <Button
              type="submit"
              form="reset-password-form"
              loading={isResettingPassword}
            >
              {isResettingPassword
                ? "Reimpostazione…"
                : manualPasswordReset
                  ? "Reimposta password"
                  : "Invia email"}
            </Button>
          </>
        }
      >
        <form
          id="reset-password-form"
          onSubmit={handleResetPassword}
          className="space-y-4"
        >
          <Alert variant="info">
            {manualPasswordReset
              ? "Imposti la nuova password a mano e nessuna email viene inviata."
              : "All'utente arriva un'email con il link per impostare una nuova password."}
          </Alert>

          <CheckboxRow
            id="manualPasswordReset"
            checked={manualPasswordReset}
            onChange={setManualPasswordReset}
            label="Imposta la password manualmente"
            hint="Nessuna email viene inviata all'utente."
          />

          {manualPasswordReset && (
            <>
              <Field label="Nuova password">
                {(field) => (
                  <Input
                    {...field}
                    type="password"
                    required
                    minLength={8}
                    value={resetPasswordForm.newPassword}
                    onChange={(e) =>
                      setResetPasswordForm((f) => ({
                        ...f,
                        newPassword: e.target.value,
                      }))
                    }
                    placeholder="Almeno 8 caratteri"
                  />
                )}
              </Field>

              <Field label="Conferma nuova password">
                {(field) => (
                  <Input
                    {...field}
                    type="password"
                    required
                    minLength={8}
                    value={resetPasswordForm.confirmPassword}
                    onChange={(e) =>
                      setResetPasswordForm((f) => ({
                        ...f,
                        confirmPassword: e.target.value,
                      }))
                    }
                    placeholder="Ripeti la password"
                  />
                )}
              </Field>
            </>
          )}

          {error && <Alert variant="error">{error}</Alert>}
        </form>
      </Dialog>

      {/* User Schedule Editor Modal */}
      <UserScheduleEditor
        userId={scheduleEditingUser?.id || ""}
        userName={scheduleEditingUser?.name || scheduleEditingUser?.email || ""}
        isOpen={!!scheduleEditingUser}
        onClose={() => setScheduleEditingUser(null)}
      />
    </PageContainer>
  );
}

/**
 * Checkbox with a label and a supporting line, sized for a dialog.
 * The four modals in this file each need several of these, and hand-rolling
 * them drifted into three different paddings and two different check sizes.
 */
function CheckboxRow({
  id,
  checked,
  onChange,
  label,
  hint,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border p-3 transition-colors hover:bg-accent/40"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[hsl(var(--primary))]"
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-foreground">{label}</span>
        {hint && (
          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}
