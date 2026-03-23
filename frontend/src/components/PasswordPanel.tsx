import { Button, Heading, Text, TextField } from "@react-spectrum/s2";

interface PasswordPanelProps {
  mustChangePassword: boolean;
  currentPassword: string;
  newPassword: string;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onSubmit: () => void;
}

export function PasswordPanel(props: PasswordPanelProps) {
  return (
    <div style={{ background: "#fff8d6", padding: "16px", borderRadius: "8px" }}>
      <Heading level={3}>
        {props.mustChangePassword ? "Смена пароля обязательна" : "Смена пароля"}
      </Heading>
      <Text>
        {props.mustChangePassword
          ? "Перед работой с модемом смените временный пароль."
          : "Вы можете в любой момент сменить пароль от аккаунта."}
      </Text>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "12px" }}>
        <TextField
          label="Current password"
          type="password"
          value={props.currentPassword}
          onChange={props.onCurrentPasswordChange}
        />
        <TextField
          label="New password"
          type="password"
          value={props.newPassword}
          onChange={props.onNewPasswordChange}
        />
        <Button variant="accent" onPress={props.onSubmit}>
          Change password
        </Button>
      </div>
    </div>
  );
}
