import { Button, Flex, Heading, TextArea, TextField, View } from "@adobe/react-spectrum";

interface AtCommandsPanelProps {
  command: string;
  timeoutMs: string;
  response: string;
  onCommandChange: (value: string) => void;
  onTimeoutChange: (value: string) => void;
  onResponseChange: (value: string) => void;
  onSend: () => void;
}

export function AtCommandsPanel(props: AtCommandsPanelProps) {
  return (
    <View backgroundColor="blue-100" padding="size-200" borderRadius="medium">
      <Heading level={3}>AT Commands</Heading>
      <Flex gap="size-150" wrap>
        <TextField
          label="Command"
          value={props.command}
          onChange={props.onCommandChange}
          width="100%"
          UNSAFE_className="modem-field-wide"
        />
        <TextField
          label="Timeout (ms)"
          value={props.timeoutMs}
          onChange={props.onTimeoutChange}
          width="size-1600"
          UNSAFE_className="modem-field-compact"
        />
        <Button variant="accent" onPress={props.onSend}>
          Send
        </Button>
      </Flex>
      <TextArea
        label="Response"
        value={props.response}
        onChange={props.onResponseChange}
        minHeight="size-1200"
        width="100%"
      />
    </View>
  );
}
