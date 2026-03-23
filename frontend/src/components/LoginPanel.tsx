import { Button, Form, Text, TextField } from "@react-spectrum/s2";
import UserLock from '@react-spectrum/s2/icons/UserLock';

import {style} from '@react-spectrum/s2/style' with {type: 'macro'};

interface LoginPanelProps {
  username: string;
  password: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  isBusy: boolean;
  onLogin: () => void;
}

export function LoginPanel(props: LoginPanelProps) {
  return (
      <div className={style({display: 'flex', justifyContent: 'center'})}>
        <Form size="L" labelPosition="side" isDisabled={props.isBusy}>
          <TextField
            label="Username"
            value={props.username}
            isRequired
            onChange={props.onUsernameChange} />
          <TextField
            label="Password"
            type="password"
            isRequired
            value={props.password}
            onChange={props.onPasswordChange}
          />
          <Button variant="accent" isPending={props.isBusy} onPress={props.onLogin}>
            <UserLock/>
            <Text>Login</Text>
          </Button>
        </Form>
      </div>
  );
}
