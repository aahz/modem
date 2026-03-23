import { Button, Dialog, DialogContainer, Heading, Text, TextField } from "@react-spectrum/s2";

interface PasswordDialogProps {
  isOpen: boolean;
  mustChangePassword: boolean;
  currentPassword: string;
  newPassword: string;
  isBusy: boolean;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function PasswordDialog({
  isOpen,
  mustChangePassword,
  currentPassword,
  newPassword,
  isBusy,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onSubmit,
  onClose,
}: PasswordDialogProps) {
  return (
    <DialogContainer
      onDismiss={() => {
        if (!mustChangePassword) {
          onClose();
        }
      }}
    >
      {isOpen ? (
        <Dialog aria-label="Change password">
          <Heading level={3}>
            {mustChangePassword ? "Password change required" : "Change password"}
          </Heading>
          <Text>
            {mustChangePassword
              ? "Set a new password to continue working with modem controls."
              : "Use your current password and set a new one."}
          </Text>

          <div className="dialog-fields">
            <TextField
              label="Current password"
              type="password"
              value={currentPassword}
              onChange={onCurrentPasswordChange}
            />
            <TextField
              label="New password"
              type="password"
              value={newPassword}
              onChange={onNewPasswordChange}
            />
          </div>

          <div className="dialog-actions">
            {!mustChangePassword ? (
              <Button variant="secondary" onPress={onClose} isDisabled={isBusy}>
                Cancel
              </Button>
            ) : null}
            <Button variant="accent" onPress={onSubmit} isDisabled={isBusy}>
              Save password
            </Button>
          </div>
        </Dialog>
      ) : null}
    </DialogContainer>
  );
}
