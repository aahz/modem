import {
  Button,
  Divider,
  Flex,
  Heading,
  Item,
  Picker,
  Text,
  TextArea,
  TextField,
  View,
} from "@adobe/react-spectrum";
import { ApiToken, Role } from "../types";

interface TokensPanelProps {
  tokens: ApiToken[];
  newTokenName: string;
  newTokenRole: Role;
  lastIssuedToken: string;
  onNameChange: (value: string) => void;
  onRoleChange: (value: Role) => void;
  onLastTokenChange: (value: string) => void;
  onCreateToken: () => void;
  onRevokeToken: (id: number) => void;
}

export function TokensPanel(props: TokensPanelProps) {
  return (
    <View backgroundColor="seafoam-100" padding="size-200" borderRadius="medium">
      <Heading level={3}>API Tokens</Heading>
      <Flex gap="size-150" wrap>
        <TextField label="Name" value={props.newTokenName} onChange={props.onNameChange} />
        <Picker
          label="Role"
          selectedKey={props.newTokenRole}
          onSelectionChange={(key) => props.onRoleChange(String(key) as Role)}
        >
          <Item key="user">user</Item>
          <Item key="admin">admin</Item>
        </Picker>
        <Button variant="accent" onPress={props.onCreateToken}>
          Create token
        </Button>
      </Flex>
      {props.lastIssuedToken ? (
        <TextArea
          label="New token (save now)"
          value={props.lastIssuedToken}
          onChange={props.onLastTokenChange}
          width="100%"
        />
      ) : null}
      <Divider size="S" marginY="size-100" />
      <Flex direction="column" gap="size-100">
        {props.tokens.map((item) => (
          <Flex key={item.id} justifyContent="space-between" alignItems="center" gap="size-100">
            <Text>
              #{item.id} {item.name} ({item.role}) created {item.created_at}
              {item.revoked_at ? ` revoked ${item.revoked_at}` : ""}
            </Text>
            {!item.revoked_at ? (
              <Button variant="secondary" onPress={() => props.onRevokeToken(item.id)}>
                Revoke
              </Button>
            ) : null}
          </Flex>
        ))}
      </Flex>
    </View>
  );
}
