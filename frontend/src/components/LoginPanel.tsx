import { Button, Flex, Heading, TextField, View } from "@adobe/react-spectrum";

interface LoginPanelProps {
  username: string;
  password: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onLogin: () => void;
}

export function LoginPanel(props: LoginPanelProps) {
  return (
    <View backgroundColor="gray-75" padding="size-200" borderRadius="medium">
      <Heading level={3}>Вход</Heading>
      <Flex gap="size-150" wrap>
        <TextField label="Username" value={props.username} onChange={props.onUsernameChange} />
        <TextField
          label="Password"
          type="password"
          value={props.password}
          onChange={props.onPasswordChange}
        />
        <Button variant="accent" onPress={props.onLogin}>
          Login
        </Button>
      </Flex>
    </View>
  );
}
