import {
  ActionButton,
  Button,
  ButtonGroup,
  Flex,
  Heading,
  Text,
  View,
} from "@adobe/react-spectrum";
import { RefObject } from "react";

interface TerminalPanelProps {
  enabled: boolean;
  connected: boolean;
  hostRef: RefObject<HTMLDivElement>;
  onToggleVisible: () => void;
  onToggleConnection: () => void;
}

export function TerminalPanel(props: TerminalPanelProps) {
  return (
    <View backgroundColor="indigo-100" padding="size-200" borderRadius="medium">
      <Flex justifyContent="space-between" alignItems="center" gap="size-150" wrap>
        <Heading level={3}>Interactive Modem Terminal</Heading>
        <ButtonGroup>
          <ActionButton onPress={props.onToggleVisible}>
            <Text>{props.enabled ? "Hide" : "Show"}</Text>
          </ActionButton>
          <Button variant="accent" onPress={props.onToggleConnection}>
            {props.connected ? "Disconnect" : "Connect"}
          </Button>
        </ButtonGroup>
      </Flex>
      {props.enabled ? <View ref={props.hostRef} id="xterm-host" /> : null}
    </View>
  );
}
