import {
  Button,
  Divider,
  Heading,
  Picker,
  PickerItem,
  Text,
  TextArea,
  TextField,
} from "@react-spectrum/s2";
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
    <div style={{ background: "#d9fff2", padding: "16px", borderRadius: "8px" }}>
      <Heading level={3}>API Tokens</Heading>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <TextField label="Name" value={props.newTokenName} onChange={props.onNameChange} />
        <Picker
          label="Role"
          selectedKey={props.newTokenRole}
          onSelectionChange={(key) => props.onRoleChange(String(key) as Role)}
        >
          <PickerItem id="user">user</PickerItem>
          <PickerItem id="admin">admin</PickerItem>
        </Picker>
        <Button variant="accent" onPress={props.onCreateToken}>
          Create token
        </Button>
      </div>
      {props.lastIssuedToken ? (
        <TextArea
          label="New token (save now)"
          value={props.lastIssuedToken}
          onChange={props.onLastTokenChange}
          width="100%"
        />
      ) : null}
      <Divider size="S" marginY="size-100" />
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {props.tokens.map((item) => (
          <div
            key={item.id}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}
          >
            <Text>
              #{item.id} {item.name} ({item.role}) created {item.created_at}
              {item.revoked_at ? ` revoked ${item.revoked_at}` : ""}
            </Text>
            {!item.revoked_at ? (
              <Button variant="secondary" onPress={() => props.onRevokeToken(item.id)}>
                Revoke
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
