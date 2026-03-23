import { useRef } from 'react'
import {
  ActionButton,
  Button,
  ButtonGroup,
  Cell,
  Column,
  Content,
  Dialog,
  DialogContainer,
  Heading,
  Picker,
  PickerItem,
  Row,
  StatusLight,
  TableBody,
  TableHeader,
  TableView,
  TextArea,
  TextField,
  ToastQueue,
} from "@react-spectrum/s2";
import { style } from '@react-spectrum/s2/style' with {type: 'macro'};
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
  const inputRef = useRef(null);

  return (
    <section className={style({display: 'flex', flexDirection: 'column', gap: 16})}>
      <Heading level={3}>Access Tokens</Heading>

      <div className={style({
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'start',
        alignItems: 'end',
        gap: 16,
      })}>
        <div
            style={{flex: 3}}>
          <TextField
              label="Name"
              value={props.newTokenName}
              onChange={props.onNameChange} />
        </div>

        <div
            style={{flex: 2}}>
          <Picker
              label="Role"
              selectedKey={props.newTokenRole}
              onSelectionChange={(key) => props.onRoleChange(String(key) as Role)}
          >
            <PickerItem id="user">user</PickerItem>
            <PickerItem id="admin">admin</PickerItem>
          </Picker>
        </div>


        <ActionButton onPress={props.onCreateToken}>
          Create token
        </ActionButton>

        <DialogContainer onDismiss={() => props.onLastTokenChange('')}>
          {!!props.lastIssuedToken && (
              <Dialog size="L">
                <Heading slot="title">New API access token</Heading>
                <Content>
                  <TextField
                      ref={inputRef}
                      size="L"
                      value={props.lastIssuedToken || 'Generating new access token…'}
                      isReadOnly
                      autoCorrect="false"
                      spellCheck="false"
                      onChange={props.onLastTokenChange}
                  />
                </Content>
                <ButtonGroup>
                  <Button
                      variant="secondary"
                      onPress={() => props.onLastTokenChange('')}>
                    Close
                  </Button>
                  <Button
                      variant="accent"
                      onPress={async () => {
                        try {
                          await window.navigator.clipboard.writeText(props.lastIssuedToken);
                          ToastQueue.positive('Token copied to clipboard');
                        }
                        catch (err) {
                          try {
                            (inputRef.current as unknown as any)?.select();

                            if (window.document.execCommand('copy')) {
                              (inputRef.current as unknown as any)?.getInputElement()?.blur();
                              ToastQueue.positive('Token copied to clipboard', {timeout: 3000});
                            }
                            else {
                              throw new Error(`Failed to use clipboard. ${(err as Error)?.message}`)
                            }
                          }
                          catch (err) {
                            ToastQueue.negative(`Failed to copy token. ${(err as Error)?.message}`, {timeout: 5000})
                          }
                        }
                      }}>Copy to clipboard</Button>
                </ButtonGroup>
              </Dialog>
          )}
        </DialogContainer>
      </div>

      {(props.tokens?.length ?? 0) > 0 && (
          <TableView aria-label="API tokens" density="spacious">
            <TableHeader>
              <Column id="id">ID</Column>
              <Column id="role">Role</Column>
              <Column id="name" isRowHeader>Name</Column>
              <Column id="created">Created</Column>
              <Column id="lastUsed">Last used</Column>
              <Column id="revoked">Revoked</Column>
              <Column id="actions">Actions</Column>
            </TableHeader>
            <TableBody items={props.tokens}>
              {(item) => (
                  <Row id={item.id}>
                    <Cell># {item.id}</Cell>
                    <Cell>{item.role}</Cell>
                    <Cell>
                      <StatusLight variant={item.revoked_at ? "negative" : "positive"}>
                        {item.name}
                      </StatusLight>
                    </Cell>
                    <Cell>{item.created_at}</Cell>
                    <Cell>{item.last_used_at ?? "-"}</Cell>
                    <Cell>{item.revoked_at ?? "-"}</Cell>
                    <Cell>
                      {!item.revoked_at ? (
                          <ActionButton onPress={() => props.onRevokeToken(item.id)}>
                            Revoke
                          </ActionButton>
                      ) : (
                          <ActionButton isDisabled>
                            Inactive
                          </ActionButton>
                      )}
                    </Cell>
                  </Row>
              )}
            </TableBody>
          </TableView>
      )}
    </section>
  );
}
