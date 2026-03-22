import { Button, Flex, Heading, Text, TextField, View } from "@adobe/react-spectrum";

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
    <View backgroundColor="yellow-100" padding="size-200" borderRadius="medium">
      <Heading level={3}>
        {props.mustChangePassword ? "Смена пароля обязательна" : "Смена пароля"}
      </Heading>
      <Text>
        {props.mustChangePassword
          ? "Перед работой с модемом смените временный пароль."
          : "Вы можете в любой момент сменить пароль от аккаунта."}
      </Text>
      <Flex gap="size-150" wrap marginTop="size-150">
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
      </Flex>
    </View>
  );
}
