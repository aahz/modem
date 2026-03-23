import {
  ActionButton,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  Header,
  Heading,
  ProgressCircle,
  StatusLight,
  Text,
} from "@react-spectrum/s2";
import ExportTo from '@react-spectrum/s2/icons/ExportTo';
import FileText from '@react-spectrum/s2/icons/FileText';
import FindAndReplace from '@react-spectrum/s2/icons/FindAndReplace';
import CursorClick from '@react-spectrum/s2/icons/CursorClick';
import Key from '@react-spectrum/s2/icons/Key';
import MenuHamburger from '@react-spectrum/s2/icons/MenuHamburger';
import Publish from '@react-spectrum/s2/icons/Publish';
import SocialNetwork from '@react-spectrum/s2/icons/SocialNetwork';
import { style } from '@react-spectrum/s2/style' with {type: 'macro'};
import { Principal } from "../types";

type PageKey = "home" | "tokens";

interface AppHeaderProps {
  activePage: PageKey;
  user: Principal;
  modemStatus: {
    connected: boolean;
    path: string;
    baudRate: number;
    lastError: string | null;
  } | null;
  atModeReady: boolean | null;
  docsToken: string;
  isBusy: boolean;
  onHome: () => void;
  onTokens: () => void;
  onCheckMode: () => void;
  onRecoverMode: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
}

export function AppHeader({
  activePage,
  user,
  modemStatus,
  atModeReady,
  docsToken,
  isBusy,
  onHome,
  onTokens,
  onCheckMode,
  onRecoverMode,
  onChangePassword,
  onLogout,
}: AppHeaderProps) {
  return (
    <header className={style({display: 'flex', justifyContent: 'space-between', alignItems: 'center'})}>
      <div className={style({display: "flex", flexDirection: 'row', gap: 16, justifyContent: 'start', alignItems: 'center'})}>
        <StatusLight variant={modemStatus?.connected ? 'positive' : 'negative'}>
          {modemStatus?.path ? `${modemStatus.path} @ ${modemStatus.baudRate}` : 'no device'}
        </StatusLight>
      </div>

      <div className={style({display: "flex", flexDirection: 'row', gap: 16, justifyContent: 'start', alignItems: 'center'})}>
        {isBusy ? <ProgressCircle aria-label="busy" isIndeterminate size="S" /> : undefined}

        <StatusLight variant={((atModeReady) => {
          if (atModeReady === null) {
            return 'notice';
          }

          return atModeReady ? 'positive' : 'negative';
        })(atModeReady)}>
          AT mode
        </StatusLight>

        <MenuTrigger>
          <ActionButton>
            <MenuHamburger />
          </ActionButton>
          <Menu selectedKeys={activePage ? [activePage] : []}>
            <MenuSection>
              <Header>
                <Heading>Service</Heading>
              </Header>
              <MenuItem key="home" onPress={onHome}>
                <Publish />
                <Text>AT Commands</Text>
              </MenuItem>
              {user.role === 'admin' && (
                  <MenuItem key="tokens" onPress={onTokens}>
                    <SocialNetwork />
                    <Text>Access tokens</Text>
                  </MenuItem>
              )}
            </MenuSection>
            <MenuSection>
              <Header>
                <Heading>Tools</Heading>
              </Header>
              <MenuItem onPress={onCheckMode}>
                <FindAndReplace />
                <Text>Check AT mode</Text>
              </MenuItem>
              <MenuItem onPress={onRecoverMode}>
                <CursorClick />
                <Text>Recover modem</Text>
              </MenuItem>
              {user.role === 'admin' && (
                  <MenuItem onPress={() => {
                    window.open(`/docs?token=${encodeURIComponent(docsToken)}`, '_blank', 'noreferrer');
                  }}>
                    <FileText />
                    <Text>Open documentation</Text>
                  </MenuItem>
              )}
            </MenuSection>
            <MenuSection>
              <Header>
                <Heading>Account</Heading>
                <Text slot="description">{user.username} [{user.role}]</Text>
              </Header>
              <MenuItem onPress={onChangePassword}>
                <Key />
                <Text>Change password</Text>
              </MenuItem>
              <MenuItem onPress={onLogout}>
                <ExportTo />
                <Text>Logout</Text>
              </MenuItem>
            </MenuSection>
          </Menu>
        </MenuTrigger>
      </div>
    </header>
  );
}
