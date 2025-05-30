import { useDebouncedCallback } from "use-debounce";
import React, {
  Fragment,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import SendWhiteIcon from "../icons/send-white.svg";
import BrainIcon from "../icons/brain.svg";
import RenameIcon from "../icons/rename.svg";
import EditIcon from "../icons/rename.svg";
import ExportIcon from "../icons/share.svg";
import ReturnIcon from "../icons/return.svg";
import CopyIcon from "../icons/copy.svg";
import SpeakIcon from "../icons/speak.svg";
import SpeakStopIcon from "../icons/speak-stop.svg";
import LoadingIcon from "../icons/three-dots.svg";
import LoadingButtonIcon from "../icons/loading.svg";
import PromptIcon from "../icons/prompt.svg";
import MaskIcon from "../icons/mask.svg";
import MaxIcon from "../icons/max.svg";
import MinIcon from "../icons/min.svg";
import ResetIcon from "../icons/reload.svg";
import ReloadIcon from "../icons/reload.svg";
import BreakIcon from "../icons/break.svg";
import SettingsIcon from "../icons/chat-settings.svg";
import DeleteIcon from "../icons/clear.svg";
import PinIcon from "../icons/pin.svg";
import ConfirmIcon from "../icons/confirm.svg";
import CloseIcon from "../icons/close.svg";
import CancelIcon from "../icons/cancel.svg";
import FileTextIcon from "../icons/file-text-icon.svg";
import FolderIcon from "../icons/folder-icon.svg";
import LightIcon from "../icons/light.svg";
import DarkIcon from "../icons/dark.svg";
import AutoIcon from "../icons/auto.svg";
import BottomIcon from "../icons/bottom.svg";
import StopIcon from "../icons/pause.svg";
import RobotIcon from "../icons/robot.svg";
import SizeIcon from "../icons/size.svg";
import QualityIcon from "../icons/hd.svg";
import StyleIcon from "../icons/palette.svg";
import PluginIcon from "../icons/plugin.svg";
import ShortcutkeyIcon from "../icons/shortcutkey.svg";
import McpToolIcon from "../icons/tool.svg";
import HeadphoneIcon from "../icons/headphone.svg";
import {
  BOT_HELLO,
  ChatMessage,
  createMessage,
  DEFAULT_TOPIC,
  ModelType,
  SubmitKey,
  Theme,
  useAccessStore,
  useAppConfig,
  useChatStore,
  usePluginStore,
  type MessageAttachment,
} from "../store";

import {
  autoGrowTextArea,
  copyToClipboard,
  getMessageImages,
  getMessageTextContent,
  isDalle3,
  isVisionModel,
  safeLocalStorage,
  getModelSizes,
  supportsCustomSize,
  useMobileScreen,
  selectOrCopy,
  showPlugins,
} from "../utils";

import { uploadImage as uploadImageRemote } from "@/app/utils/chat";

import dynamic from "next/dynamic";
import * as XLSX from "xlsx";

import { ChatControllerPool } from "../client/controller";
import { DalleQuality, DalleStyle, ModelSize } from "../typing";
import { Prompt, usePromptStore } from "../store/prompt";
import Locale from "../locales";

import { IconButton } from "./button";
import styles from "./chat.module.scss";

import {
  List,
  ListItem,
  Modal,
  Selector,
  showConfirm,
  showPrompt,
  showToast,
} from "./ui-lib";
import { useNavigate } from "react-router-dom";
import {
  CHAT_PAGE_SIZE,
  DEFAULT_TTS_ENGINE,
  ModelProvider,
  Path,
  REQUEST_TIMEOUT_MS,
  ServiceProvider,
  UNFINISHED_INPUT,
} from "../constant";
import { Avatar } from "./emoji";
import { ContextPrompts, MaskAvatar, MaskConfig } from "./mask";
import { useMaskStore } from "../store/mask";
import { ChatCommandPrefix, useChatCommand, useCommand } from "../command";
import { prettyObject } from "../utils/format";
import { ExportMessageModal } from "./exporter";
import { getClientConfig } from "../config/client";
import { useAllModels } from "../utils/hooks";
import { ClientApi, MultimodalContent } from "../client/api";
import { createTTSPlayer } from "../utils/audio";
import { MsEdgeTTS, OUTPUT_FORMAT } from "../utils/ms_edge_tts";

import { isEmpty } from "lodash-es";
import { getModelProvider } from "../utils/model";
import { RealtimeChat } from "@/app/components/realtime-chat";
import clsx from "clsx";
import { getAvailableClientsCount, isMcpEnabled } from "../mcp/actions";

const localStorage = safeLocalStorage();

const ttsPlayer = createTTSPlayer();

const Markdown = dynamic(async () => (await import("./markdown")).Markdown, {
  loading: () => <LoadingIcon />,
});

const MCPAction = () => {
  const navigate = useNavigate();
  const [count, setCount] = useState<number>(0);
  const [mcpEnabled, setMcpEnabled] = useState(false);

  useEffect(() => {
    const checkMcpStatus = async () => {
      const enabled = await isMcpEnabled();
      setMcpEnabled(enabled);
      if (enabled) {
        const count = await getAvailableClientsCount();
        setCount(count);
      }
    };
    checkMcpStatus();
  }, []);

  if (!mcpEnabled) return null;

  return (
    <ChatAction
      onClick={() => navigate(Path.McpMarket)}
      text={`MCP${count ? ` (${count})` : ""}`}
      icon={<McpToolIcon />}
    />
  );
};

export function SessionConfigModel(props: { onClose: () => void }) {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const maskStore = useMaskStore();
  const navigate = useNavigate();

  return (
    <div className="modal-mask">
      <Modal
        title={Locale.Context.Edit}
        onClose={() => props.onClose()}
        actions={[
          <IconButton
            key="reset"
            icon={<ResetIcon />}
            bordered
            text={Locale.Chat.Config.Reset}
            onClick={async () => {
              if (await showConfirm(Locale.Memory.ResetConfirm)) {
                chatStore.updateTargetSession(
                  session,
                  (session) => (session.memoryPrompt = ""),
                );
              }
            }}
          />,
          <IconButton
            key="copy"
            icon={<CopyIcon />}
            bordered
            text={Locale.Chat.Config.SaveAs}
            onClick={() => {
              navigate(Path.Masks);
              setTimeout(() => {
                maskStore.create(session.mask);
              }, 500);
            }}
          />,
        ]}
      >
        <MaskConfig
          mask={session.mask}
          updateMask={(updater) => {
            const mask = { ...session.mask };
            updater(mask);
            chatStore.updateTargetSession(
              session,
              (session) => (session.mask = mask),
            );
          }}
          shouldSyncFromGlobal
          extraListItems={
            session.mask.modelConfig.sendMemory ? (
              <ListItem
                className="copyable"
                title={`${Locale.Memory.Title} (${session.lastSummarizeIndex} of ${session.messages.length})`}
                subTitle={session.memoryPrompt || Locale.Memory.EmptyContent}
              ></ListItem>
            ) : (
              <></>
            )
          }
        ></MaskConfig>
      </Modal>
    </div>
  );
}

function PromptToast(props: {
  showToast?: boolean;
  showModal?: boolean;
  setShowModal: (_: boolean) => void;
}) {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const context = session.mask.context;

  return (
    <div className={styles["prompt-toast"]} key="prompt-toast">
      {props.showToast && context.length > 0 && (
        <div
          className={clsx(styles["prompt-toast-inner"], "clickable")}
          role="button"
          onClick={() => props.setShowModal(true)}
        >
          <BrainIcon />
          <span className={styles["prompt-toast-content"]}>
            {Locale.Context.Toast(context.length)}
          </span>
        </div>
      )}
      {props.showModal && (
        <SessionConfigModel onClose={() => props.setShowModal(false)} />
      )}
    </div>
  );
}

function useSubmitHandler() {
  const config = useAppConfig();
  const submitKey = config.submitKey;
  const isComposing = useRef(false);

  useEffect(() => {
    const onCompositionStart = () => {
      isComposing.current = true;
    };
    const onCompositionEnd = () => {
      isComposing.current = false;
    };

    window.addEventListener("compositionstart", onCompositionStart);
    window.addEventListener("compositionend", onCompositionEnd);

    return () => {
      window.removeEventListener("compositionstart", onCompositionStart);
      window.removeEventListener("compositionend", onCompositionEnd);
    };
  }, []);

  const shouldSubmit = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Fix Chinese input method "Enter" on Safari
    if (e.keyCode == 229) return false;
    if (e.key !== "Enter") return false;
    if (e.key === "Enter" && (e.nativeEvent.isComposing || isComposing.current))
      return false;
    return (
      (config.submitKey === SubmitKey.AltEnter && e.altKey) ||
      (config.submitKey === SubmitKey.CtrlEnter && e.ctrlKey) ||
      (config.submitKey === SubmitKey.ShiftEnter && e.shiftKey) ||
      (config.submitKey === SubmitKey.MetaEnter && e.metaKey) ||
      (config.submitKey === SubmitKey.Enter &&
        !e.altKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.metaKey)
    );
  };

  return {
    submitKey,
    shouldSubmit,
  };
}

export type RenderPrompt = Pick<Prompt, "title" | "content">;

export function PromptHints(props: {
  prompts: RenderPrompt[];
  onPromptSelect: (prompt: RenderPrompt) => void;
}) {
  const noPrompts = props.prompts.length === 0;
  const [selectIndex, setSelectIndex] = useState(0);
  const selectedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectIndex(0);
  }, [props.prompts.length]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (noPrompts || e.metaKey || e.altKey || e.ctrlKey) {
        return;
      }
      // arrow up / down to select prompt
      const changeIndex = (delta: number) => {
        e.stopPropagation();
        e.preventDefault();
        const nextIndex = Math.max(
          0,
          Math.min(props.prompts.length - 1, selectIndex + delta),
        );
        setSelectIndex(nextIndex);
        selectedRef.current?.scrollIntoView({
          block: "center",
        });
      };

      if (e.key === "ArrowUp") {
        changeIndex(1);
      } else if (e.key === "ArrowDown") {
        changeIndex(-1);
      } else if (e.key === "Enter") {
        const selectedPrompt = props.prompts.at(selectIndex);
        if (selectedPrompt) {
          props.onPromptSelect(selectedPrompt);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.prompts.length, selectIndex]);

  if (noPrompts) return null;
  return (
    <div className={styles["prompt-hints"]}>
      {props.prompts.map((prompt, i) => (
        <div
          ref={i === selectIndex ? selectedRef : null}
          className={clsx(styles["prompt-hint"], {
            [styles["prompt-hint-selected"]]: i === selectIndex,
          })}
          key={prompt.title + i.toString()}
          onClick={() => props.onPromptSelect(prompt)}
          onMouseEnter={() => setSelectIndex(i)}
        >
          <div className={styles["hint-title"]}>{prompt.title}</div>
          <div className={styles["hint-content"]}>{prompt.content}</div>
        </div>
      ))}
    </div>
  );
}

function ClearContextDivider() {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();

  return (
    <div
      className={styles["clear-context"]}
      onClick={() =>
        chatStore.updateTargetSession(
          session,
          (session) => (session.clearContextIndex = undefined),
        )
      }
    >
      <div className={styles["clear-context-tips"]}>{Locale.Context.Clear}</div>
      <div className={styles["clear-context-revert-btn"]}>
        {Locale.Context.Revert}
      </div>
    </div>
  );
}

export function ChatAction(props: {
  text: string;
  icon: JSX.Element;
  onClick: () => void;
}) {
  const iconRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState({
    full: 16,
    icon: 16,
  });

  function updateWidth() {
    if (!iconRef.current || !textRef.current) return;
    const getWidth = (dom: HTMLDivElement) => dom.getBoundingClientRect().width;
    const textWidth = getWidth(textRef.current);
    const iconWidth = getWidth(iconRef.current);
    setWidth({
      full: textWidth + iconWidth,
      icon: iconWidth,
    });
  }

  return (
    <div
      className={clsx(styles["chat-input-action"], "clickable")}
      onClick={() => {
        props.onClick();
        setTimeout(updateWidth, 1);
      }}
      onMouseEnter={updateWidth}
      onTouchStart={updateWidth}
      style={
        {
          "--icon-width": `${width.icon}px`,
          "--full-width": `${width.full}px`,
        } as React.CSSProperties
      }
    >
      <div ref={iconRef} className={styles["icon"]}>
        {props.icon}
      </div>
      <div className={styles["text"]} ref={textRef}>
        {props.text}
      </div>
    </div>
  );
}

function useScrollToBottom(
  scrollRef: RefObject<HTMLDivElement>,
  detach: boolean = false,
  messages: ChatMessage[],
) {
  // for auto-scroll
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollDomToBottom = useCallback(() => {
    const dom = scrollRef.current;
    if (dom) {
      requestAnimationFrame(() => {
        setAutoScroll(true);
        dom.scrollTo(0, dom.scrollHeight);
      });
    }
  }, [scrollRef]);

  // auto scroll
  useEffect(() => {
    if (autoScroll && !detach) {
      scrollDomToBottom();
    }
  });

  // auto scroll when messages length changes
  const lastMessagesLength = useRef(messages.length);
  useEffect(() => {
    if (messages.length > lastMessagesLength.current && !detach) {
      scrollDomToBottom();
    }
    lastMessagesLength.current = messages.length;
  }, [messages.length, detach, scrollDomToBottom]);

  return {
    scrollRef,
    autoScroll,
    setAutoScroll,
    scrollDomToBottom,
  };
}

export function ChatActions(props: {
  uploadImage: () => void;
  setAttachImages: (images: string[]) => void;
  setUploading: (uploading: boolean) => void;
  showPromptModal: () => void;
  scrollToBottom: () => void;
  showPromptHints: () => void;
  hitBottom: boolean;
  uploading: boolean;
  setShowShortcutKeyModal: React.Dispatch<React.SetStateAction<boolean>>;
  setUserInput: (input: string) => void;
  setShowChatSidePanel: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const config = useAppConfig();
  const navigate = useNavigate();
  const chatStore = useChatStore();
  const pluginStore = usePluginStore();
  const session = chatStore.currentSession();

  // switch themes
  const theme = config.theme;

  function nextTheme() {
    const themes = [Theme.Auto, Theme.Light, Theme.Dark];
    const themeIndex = themes.indexOf(theme);
    const nextIndex = (themeIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    config.update((config) => (config.theme = nextTheme));
  }

  // stop all responses
  const couldStop = ChatControllerPool.hasPending();
  const stopAll = () => ChatControllerPool.stopAll();

  // switch model
  const currentModel = session.mask.modelConfig.model;
  const currentProviderName =
    session.mask.modelConfig?.providerName || ServiceProvider.OpenAI;
  const allModels = useAllModels();
  const models = useMemo(() => {
    const filteredModels = allModels.filter((m) => m.available);
    const defaultModel = filteredModels.find((m) => m.isDefault);

    if (defaultModel) {
      const arr = [
        defaultModel,
        ...filteredModels.filter((m) => m !== defaultModel),
      ];
      return arr;
    } else {
      return filteredModels;
    }
  }, [allModels]);
  const currentModelName = useMemo(() => {
    const model = models.find(
      (m) =>
        m.name == currentModel &&
        m?.provider?.providerName == currentProviderName,
    );
    return model?.displayName ?? "";
  }, [models, currentModel, currentProviderName]);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showPluginSelector, setShowPluginSelector] = useState(false);
  const [showUploadImage, setShowUploadImage] = useState(false);

  const [showSizeSelector, setShowSizeSelector] = useState(false);
  const [showQualitySelector, setShowQualitySelector] = useState(false);
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const modelSizes = getModelSizes(currentModel);
  const dalle3Qualitys: DalleQuality[] = ["standard", "hd"];
  const dalle3Styles: DalleStyle[] = ["vivid", "natural"];
  const currentSize =
    session.mask.modelConfig?.size ?? ("1024x1024" as ModelSize);
  const currentQuality = session.mask.modelConfig?.quality ?? "standard";
  const currentStyle = session.mask.modelConfig?.style ?? "vivid";

  const isMobileScreen = useMobileScreen();

  useEffect(() => {
    const show = isVisionModel(currentModel);
    setShowUploadImage(show);
    if (!show) {
      props.setAttachImages([]);
      props.setUploading(false);
    }

    // if current model is not available
    // switch to first available model
    const isUnavailableModel = !models.some((m) => m.name === currentModel);
    if (isUnavailableModel && models.length > 0) {
      // show next model to default model if exist
      let nextModel = models.find((model) => model.isDefault) || models[0];
      chatStore.updateTargetSession(session, (session) => {
        session.mask.modelConfig.model = nextModel.name;
        session.mask.modelConfig.providerName = nextModel?.provider
          ?.providerName as ServiceProvider;
      });
      showToast(
        nextModel?.provider?.providerName == "ByteDance"
          ? nextModel.displayName
          : nextModel.name,
      );
    }
  }, [chatStore, currentModel, models, session]);

  return (
    <div className={styles["chat-input-actions"]}>
      <>
        {couldStop && (
          <ChatAction
            onClick={stopAll}
            text={Locale.Chat.InputActions.Stop}
            icon={<StopIcon />}
          />
        )}
        {!props.hitBottom && (
          <ChatAction
            onClick={props.scrollToBottom}
            text={Locale.Chat.InputActions.ToBottom}
            icon={<BottomIcon />}
          />
        )}
        {props.hitBottom && (
          <ChatAction
            onClick={props.showPromptModal}
            text={Locale.Chat.InputActions.Settings}
            icon={<SettingsIcon />}
          />
        )}

        {showUploadImage && (
          <ChatAction
            onClick={props.uploadImage}
            text={Locale.Chat.InputActions.UploadImage}
            icon={props.uploading ? <LoadingButtonIcon /> : <FolderIcon />}
          />
        )}
        <ChatAction
          onClick={nextTheme}
          text={Locale.Chat.InputActions.Theme[theme]}
          icon={
            <>
              {theme === Theme.Auto ? (
                <AutoIcon />
              ) : theme === Theme.Light ? (
                <LightIcon />
              ) : theme === Theme.Dark ? (
                <DarkIcon />
              ) : null}
            </>
          }
        />

        <ChatAction
          onClick={props.showPromptHints}
          text={Locale.Chat.InputActions.Prompt}
          icon={<PromptIcon />}
        />

        <ChatAction
          onClick={() => {
            navigate(Path.Masks);
          }}
          text={Locale.Chat.InputActions.Masks}
          icon={<MaskIcon />}
        />

        <ChatAction
          text={Locale.Chat.InputActions.Clear}
          icon={<BreakIcon />}
          onClick={() => {
            chatStore.updateTargetSession(session, (session) => {
              if (session.clearContextIndex === session.messages.length) {
                session.clearContextIndex = undefined;
              } else {
                session.clearContextIndex = session.messages.length;
                session.memoryPrompt = ""; // will clear memory
              }
            });
          }}
        />

        <ChatAction
          onClick={() => setShowModelSelector(true)}
          text={currentModelName}
          icon={<RobotIcon />}
        />

        {showModelSelector && (
          <Selector
            defaultSelectedValue={`${currentModel}@${currentProviderName}`}
            items={models.map((m) => ({
              title: `${m.displayName}${
                m?.provider?.providerName
                  ? " (" + m?.provider?.providerName + ")"
                  : ""
              }`,
              value: `${m.name}@${m?.provider?.providerName}`,
            }))}
            onClose={() => setShowModelSelector(false)}
            onSelection={(s) => {
              if (s.length === 0) return;
              const [model, providerName] = getModelProvider(s[0]);
              chatStore.updateTargetSession(session, (session) => {
                session.mask.modelConfig.model = model as ModelType;
                session.mask.modelConfig.providerName =
                  providerName as ServiceProvider;
                session.mask.syncGlobalConfig = false;
              });
              if (providerName == "ByteDance") {
                const selectedModel = models.find(
                  (m) =>
                    m.name == model &&
                    m?.provider?.providerName == providerName,
                );
                showToast(selectedModel?.displayName ?? "");
              } else {
                showToast(model);
              }
            }}
          />
        )}

        {supportsCustomSize(currentModel) && (
          <ChatAction
            onClick={() => setShowSizeSelector(true)}
            text={currentSize}
            icon={<SizeIcon />}
          />
        )}

        {showSizeSelector && (
          <Selector
            defaultSelectedValue={currentSize}
            items={modelSizes.map((m) => ({
              title: m,
              value: m,
            }))}
            onClose={() => setShowSizeSelector(false)}
            onSelection={(s) => {
              if (s.length === 0) return;
              const size = s[0];
              chatStore.updateTargetSession(session, (session) => {
                session.mask.modelConfig.size = size;
              });
              showToast(size);
            }}
          />
        )}

        {isDalle3(currentModel) && (
          <ChatAction
            onClick={() => setShowQualitySelector(true)}
            text={currentQuality}
            icon={<QualityIcon />}
          />
        )}

        {showQualitySelector && (
          <Selector
            defaultSelectedValue={currentQuality}
            items={dalle3Qualitys.map((m) => ({
              title: m,
              value: m,
            }))}
            onClose={() => setShowQualitySelector(false)}
            onSelection={(q) => {
              if (q.length === 0) return;
              const quality = q[0];
              chatStore.updateTargetSession(session, (session) => {
                session.mask.modelConfig.quality = quality;
              });
              showToast(quality);
            }}
          />
        )}

        {isDalle3(currentModel) && (
          <ChatAction
            onClick={() => setShowStyleSelector(true)}
            text={currentStyle}
            icon={<StyleIcon />}
          />
        )}

        {showStyleSelector && (
          <Selector
            defaultSelectedValue={currentStyle}
            items={dalle3Styles.map((m) => ({
              title: m,
              value: m,
            }))}
            onClose={() => setShowStyleSelector(false)}
            onSelection={(s) => {
              if (s.length === 0) return;
              const style = s[0];
              chatStore.updateTargetSession(session, (session) => {
                session.mask.modelConfig.style = style;
              });
              showToast(style);
            }}
          />
        )}

        {showPlugins(currentProviderName, currentModel) && (
          <ChatAction
            onClick={() => {
              if (pluginStore.getAll().length == 0) {
                navigate(Path.Plugins);
              } else {
                setShowPluginSelector(true);
              }
            }}
            text={Locale.Plugin.Name}
            icon={<PluginIcon />}
          />
        )}
        {showPluginSelector && (
          <Selector
            multiple
            defaultSelectedValue={chatStore.currentSession().mask?.plugin}
            items={pluginStore.getAll().map((item) => ({
              title: `${item?.title}@${item?.version}`,
              value: item?.id,
            }))}
            onClose={() => setShowPluginSelector(false)}
            onSelection={(s) => {
              chatStore.updateTargetSession(session, (session) => {
                session.mask.plugin = s as string[];
              });
            }}
          />
        )}

        {!isMobileScreen && (
          <ChatAction
            onClick={() => props.setShowShortcutKeyModal(true)}
            text={Locale.Chat.ShortcutKey.Title}
            icon={<ShortcutkeyIcon />}
          />
        )}
        {!isMobileScreen && <MCPAction />}
      </>
      <div className={styles["chat-input-actions-end"]}>
        {config.realtimeConfig.enable && (
          <ChatAction
            onClick={() => props.setShowChatSidePanel(true)}
            text={"Realtime Chat"}
            icon={<HeadphoneIcon />}
          />
        )}
      </div>
    </div>
  );
}

export function EditMessageModal(props: { onClose: () => void }) {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const [messages, setMessages] = useState(session.messages.slice());

  return (
    <div className="modal-mask">
      <Modal
        title={Locale.Chat.EditMessage.Title}
        onClose={props.onClose}
        actions={[
          <IconButton
            text={Locale.UI.Cancel}
            icon={<CancelIcon />}
            key="cancel"
            onClick={() => {
              props.onClose();
            }}
          />,
          <IconButton
            type="primary"
            text={Locale.UI.Confirm}
            icon={<ConfirmIcon />}
            key="ok"
            onClick={() => {
              chatStore.updateTargetSession(
                session,
                (session) => (session.messages = messages),
              );
              props.onClose();
            }}
          />,
        ]}
      >
        <List>
          <ListItem
            title={Locale.Chat.EditMessage.Topic.Title}
            subTitle={Locale.Chat.EditMessage.Topic.SubTitle}
          >
            <input
              type="text"
              value={session.topic}
              onInput={(e) =>
                chatStore.updateTargetSession(
                  session,
                  (session) => (session.topic = e.currentTarget.value),
                )
              }
            ></input>
          </ListItem>
        </List>
        <ContextPrompts
          context={messages}
          updateContext={(updater) => {
            const newMessages = messages.slice();
            updater(newMessages);
            setMessages(newMessages);
          }}
        />
      </Modal>
    </div>
  );
}

export function DeleteImageButton(props: { deleteImage: () => void }) {
  return (
    <div className={styles["delete-image"]} onClick={props.deleteImage}>
      <DeleteIcon />
    </div>
  );
}

export function ShortcutKeyModal(props: { onClose: () => void }) {
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const shortcuts = [
    {
      title: Locale.Chat.ShortcutKey.newChat,
      keys: isMac ? ["⌘", "Shift", "O"] : ["Ctrl", "Shift", "O"],
    },
    { title: Locale.Chat.ShortcutKey.focusInput, keys: ["Shift", "Esc"] },
    {
      title: Locale.Chat.ShortcutKey.copyLastCode,
      keys: isMac ? ["⌘", "Shift", ";"] : ["Ctrl", "Shift", ";"],
    },
    {
      title: Locale.Chat.ShortcutKey.copyLastMessage,
      keys: isMac ? ["⌘", "Shift", "C"] : ["Ctrl", "Shift", "C"],
    },
    {
      title: Locale.Chat.ShortcutKey.showShortcutKey,
      keys: isMac ? ["⌘", "/"] : ["Ctrl", "/"],
    },
    {
      title: Locale.Chat.ShortcutKey.clearContext,
      keys: isMac
        ? ["⌘", "Shift", "backspace"]
        : ["Ctrl", "Shift", "backspace"],
    },
  ];
  return (
    <div className="modal-mask">
      <Modal
        title={Locale.Chat.ShortcutKey.Title}
        onClose={props.onClose}
        actions={[
          <IconButton
            type="primary"
            text={Locale.UI.Confirm}
            icon={<ConfirmIcon />}
            key="ok"
            onClick={() => {
              props.onClose();
            }}
          />,
        ]}
      >
        <div className={styles["shortcut-key-container"]}>
          <div className={styles["shortcut-key-grid"]}>
            {shortcuts.map((shortcut, index) => (
              <div key={index} className={styles["shortcut-key-item"]}>
                <div className={styles["shortcut-key-title"]}>
                  {shortcut.title}
                </div>
                <div className={styles["shortcut-key-keys"]}>
                  {shortcut.keys.map((key, i) => (
                    <div key={i} className={styles["shortcut-key"]}>
                      <span>{key}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

function _Chat() {
  type RenderMessage = ChatMessage & { preview?: boolean };

  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const config = useAppConfig();
  const fontSize = config.fontSize;
  const fontFamily = config.fontFamily;

  const [showExport, setShowExport] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { submitKey, shouldSubmit } = useSubmitHandler();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrolledToBottom = scrollRef?.current
    ? Math.abs(
        scrollRef.current.scrollHeight -
          (scrollRef.current.scrollTop + scrollRef.current.clientHeight),
      ) <= 1
    : false;
  const isAttachWithTop = useMemo(() => {
    const lastMessage = scrollRef.current?.lastElementChild as HTMLElement;
    // if scrolllRef is not ready or no message, return false
    if (!scrollRef?.current || !lastMessage) return false;
    const topDistance =
      lastMessage!.getBoundingClientRect().top -
      scrollRef.current.getBoundingClientRect().top;
    // leave some space for user question
    return topDistance < 100;
  }, [scrollRef?.current?.scrollHeight]);

  const isTyping = userInput !== "";

  // if user is typing, should auto scroll to bottom
  // if user is not typing, should auto scroll to bottom only if already at bottom
  const { setAutoScroll, scrollDomToBottom } = useScrollToBottom(
    scrollRef,
    (isScrolledToBottom || isAttachWithTop) && !isTyping,
    session.messages,
  );
  const [hitBottom, setHitBottom] = useState(true);
  const isMobileScreen = useMobileScreen();
  const navigate = useNavigate();
  const [attachImages, setAttachImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // prompt hints
  const promptStore = usePromptStore();
  const [promptHints, setPromptHints] = useState<RenderPrompt[]>([]);
  const onSearch = useDebouncedCallback(
    (text: string) => {
      const matchedPrompts = promptStore.search(text);
      setPromptHints(matchedPrompts);
    },
    100,
    { leading: true, trailing: true },
  );

  // auto grow input
  const [inputRows, setInputRows] = useState(2);
  const measure = useDebouncedCallback(
    () => {
      const rows = inputRef.current ? autoGrowTextArea(inputRef.current) : 1;
      const inputRows = Math.min(
        20,
        Math.max(2 + Number(!isMobileScreen), rows),
      );
      setInputRows(inputRows);
    },
    100,
    {
      leading: true,
      trailing: true,
    },
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(measure, [userInput]);

  // chat commands shortcuts
  const chatCommands = useChatCommand({
    new: () => chatStore.newSession(),
    newm: () => navigate(Path.NewChat),
    prev: () => chatStore.nextSession(-1),
    next: () => chatStore.nextSession(1),
    clear: () =>
      chatStore.updateTargetSession(
        session,
        (session) => (session.clearContextIndex = session.messages.length),
      ),
    fork: () => chatStore.forkSession(),
    del: () => chatStore.deleteSession(chatStore.currentSessionIndex),
  });

  // only search prompts when user input is short
  const SEARCH_TEXT_LIMIT = 30;
  const onInput = (text: string) => {
    setUserInput(text);
    const n = text.trim().length;

    // clear search results
    if (n === 0) {
      setPromptHints([]);
    } else if (text.match(ChatCommandPrefix)) {
      setPromptHints(chatCommands.search(text));
    } else if (!config.disablePromptHint && n < SEARCH_TEXT_LIMIT) {
      // check if need to trigger auto completion
      if (text.startsWith("/")) {
        let searchText = text.slice(1);
        onSearch(searchText);
      }
    }
  };

  // 新的辅助函数，用于准备附件数据
  const prepareAttachmentsForBackend = (
    attachmentsDataUrls: string[],
  ): MessageAttachment[] => {
    const processedAttachments: MessageAttachment[] = [];

    for (const dataUrl of attachmentsDataUrls) {
      const { isImage, name, url } = getAttachmentInfo(dataUrl); // 使用我们定义的 getAttachmentInfo

      if (isImage) {
        processedAttachments.push({
          type: "image",
          name: name,
          url: url,
        });
      } else {
        let textContent = "";
        let errorDecoding = false;

        if (url.startsWith("data:")) {
          try {
            const base64Data = url.substring(url.indexOf(",") + 1);
            const binaryString = atob(base64Data);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const decoder = new TextDecoder("utf-8");
            textContent = decoder.decode(bytes);
          } catch (error) {
            console.error("Error decoding file content as text:", name, error);
            textContent = `[Error decoding content for file: ${name}. Reason: ${
              (error as Error).message
            }]`;
            errorDecoding = true;
          }
        } else {
          console.warn(
            "Non-image, non-data URL attachment found. Sending URL as content:",
            name,
            url,
          );
          textContent = `[File content not directly available, URL: ${url}]`;
        }

        processedAttachments.push({
          type: "textfile",
          name: name,
          content: textContent,
          decoding_error: errorDecoding,
        });
      }
    }
    return processedAttachments;
  };

  const doSubmit = (userInput: string) => {
    // --- 在函数开头立即检查 isSubmit 状态 ---
    if (isSubmitting) {
      console.log("[doSubmit] Already submitting, ignoring click");
      return;
    }

    if (userInput.trim() === "" && isEmpty(attachImages)) return;

    const matchCommand = chatCommands.match(userInput);
    if (matchCommand.matched) {
      setUserInput("");
      setPromptHints([]);
      matchCommand.invoke();
      return;
    }

    console.log("[doSubmit] Starting submission, setting isLoading to true");
    setIsSubmitting(true);

    // 使用新的辅助函数处理附件
    const processedAttachments = prepareAttachmentsForBackend(attachImages);

    chatStore
      .onUserInput(userInput, processedAttachments)
      .then(() => {
        console.log("[doSubmit] onUserInput completed successfully");
        // onUserInput 完成后再处理后续逻辑
        setAttachImages([]);
        chatStore.setLastInput(userInput);
        setUserInput("");
        setPromptHints([]);
        if (!isMobileScreen) inputRef.current?.focus();
        setAutoScroll(true);
      })
      .catch((error) => {
        console.error("Error in doSubmit:", error);
        setAttachImages([]);
        setUserInput("");
        setPromptHints([]);
        //showToast(Locale.Chat.SendError || "Failed to send message.");
      })
      .finally(() => {
        console.log("[doSubmit] Setting isLoading to false");
        setIsSubmitting(false);
      });
  };

  const onPromptSelect = (prompt: RenderPrompt) => {
    setTimeout(() => {
      setPromptHints([]);

      const matchedChatCommand = chatCommands.match(prompt.content);
      if (matchedChatCommand.matched) {
        // if user is selecting a chat command, just trigger it
        matchedChatCommand.invoke();
        setUserInput("");
      } else {
        // or fill the prompt
        setUserInput(prompt.content);
      }
      inputRef.current?.focus();
    }, 30);
  };

  // stop response
  const onUserStop = (messageId: string) => {
    ChatControllerPool.stop(session.id, messageId);
  };

  useEffect(() => {
    chatStore.updateTargetSession(session, (session) => {
      const stopTiming = Date.now() - REQUEST_TIMEOUT_MS;
      session.messages.forEach((m) => {
        // check if should stop all stale messages
        if (m.isError || new Date(m.date).getTime() < stopTiming) {
          if (m.streaming) {
            m.streaming = false;
          }

          if (m.content.length === 0) {
            m.isError = true;
            m.content = prettyObject({
              error: true,
              message: "empty response",
            });
          }
        }
      });

      // auto sync mask config from global config
      if (session.mask.syncGlobalConfig) {
        console.log("[Mask] syncing from global, name = ", session.mask.name);
        session.mask.modelConfig = { ...config.modelConfig };
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // check if should send message
  const onInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // if ArrowUp and no userInput, fill with last input
    if (
      e.key === "ArrowUp" &&
      userInput.length <= 0 &&
      !(e.metaKey || e.altKey || e.ctrlKey)
    ) {
      setUserInput(chatStore.lastInput ?? "");
      e.preventDefault();
      return;
    }
    if (shouldSubmit(e) && promptHints.length === 0) {
      if (isSubmitting) {
        // <--- 使用 isSubmitting 检查
        e.preventDefault();
        return;
      }
      doSubmit(userInput);
      e.preventDefault();
    }
  };
  const onRightClick = (e: any, message: ChatMessage) => {
    // copy to clipboard
    if (selectOrCopy(e.currentTarget, getMessageTextContent(message))) {
      if (userInput.length === 0) {
        setUserInput(getMessageTextContent(message));
      }

      e.preventDefault();
    }
  };

  const deleteMessage = (msgId?: string) => {
    chatStore.updateTargetSession(
      session,
      (session) =>
        (session.messages = session.messages.filter((m) => m.id !== msgId)),
    );
  };

  const onDelete = (msgId: string) => {
    deleteMessage(msgId);
  };

  const onResend = (message: ChatMessage) => {
    const resendingIndex = session.messages.findIndex(
      (m) => m.id === message.id,
    );

    if (resendingIndex < 0 || resendingIndex >= session.messages.length) {
      console.error("[Chat] failed to find resending message", message);
      return;
    }

    let userMessage: ChatMessage | undefined;
    let botMessage: ChatMessage | undefined;

    if (message.role === "assistant") {
      botMessage = message;
      for (let i = resendingIndex; i >= 0; i -= 1) {
        if (session.messages[i].role === "user") {
          userMessage = session.messages[i];
          break;
        }
      }
    } else if (message.role === "user") {
      userMessage = message;
      for (let i = resendingIndex; i < session.messages.length; i += 1) {
        if (session.messages[i].role === "assistant") {
          botMessage = session.messages[i];
          break;
        }
      }
    }

    if (userMessage === undefined) {
      console.error(
        "[Chat] failed to resend, user message not found for",
        message,
      );
      return;
    }

    // delete the original messages
    deleteMessage(userMessage.id);
    if (botMessage) {
      deleteMessage(botMessage.id);
    }

    setIsLoading(true);
    const textContent = getMessageTextContent(userMessage);

    let attachmentsForResend: MessageAttachment[] = [];

    if (userMessage.attachments && userMessage.attachments.length > 0) {
      // 如果用户消息中已经有 attachments 字段，直接使用它
      attachmentsForResend = [...userMessage.attachments]; // 创建副本，避免引用问题
      console.log(
        "[onResend] Using existing attachments from userMessage:",
        attachmentsForResend,
      );
    } else {
      // 回退逻辑：如果没有 attachments 字段，尝试从 getMessageImages 获取图片
      const imageUrls = getMessageImages(userMessage);
      if (imageUrls.length > 0) {
        attachmentsForResend = imageUrls.map((url) => {
          let name = "image_attachment";
          let fileExtension = "";

          try {
            const urlPath = new URL(url).pathname;
            const parts = urlPath.split("/");
            const potentialName = decodeURIComponent(parts[parts.length - 1]);
            if (potentialName) {
              name = potentialName;
              fileExtension = name
                .substring(name.lastIndexOf(".") + 1)
                .toLowerCase();
            }
          } catch (e) {
            console.warn(
              "[onResend] Failed to parse image URL for name:",
              url,
              e,
            );
          }

          return {
            type: "image" as const,
            name: name,
            url: url,
            fileExtension: fileExtension,
          };
        });
        console.log(
          "[onResend] Created attachments from getMessageImages:",
          attachmentsForResend,
        );
      }
    }

    console.log(
      "[onResend] Final attachments for resend:",
      attachmentsForResend,
    );

    // 调用 onUserInput，传递完整的附件信息
    chatStore
      .onUserInput(textContent, attachmentsForResend)
      .then(() => setIsLoading(false))
      .catch((err) => {
        console.error("Error during onResend -> onUserInput:", err);
        setIsLoading(false);
        // showToast(Locale.Chat.ResendError || "Failed to resend message.");
      });

    inputRef.current?.focus();
  };

  const onPinMessage = (message: ChatMessage) => {
    chatStore.updateTargetSession(session, (session) =>
      session.mask.context.push(message),
    );

    showToast(Locale.Chat.Actions.PinToastContent, {
      text: Locale.Chat.Actions.PinToastAction,
      onClick: () => {
        setShowPromptModal(true);
      },
    });
  };

  const accessStore = useAccessStore();
  const [speechStatus, setSpeechStatus] = useState(false);
  const [speechLoading, setSpeechLoading] = useState(false);

  async function openaiSpeech(text: string) {
    if (speechStatus) {
      ttsPlayer.stop();
      setSpeechStatus(false);
    } else {
      var api: ClientApi;
      api = new ClientApi(ModelProvider.GPT);
      const config = useAppConfig.getState();
      setSpeechLoading(true);
      ttsPlayer.init();
      let audioBuffer: ArrayBuffer;
      const { markdownToTxt } = require("markdown-to-txt");
      const textContent = markdownToTxt(text);
      if (config.ttsConfig.engine !== DEFAULT_TTS_ENGINE) {
        const edgeVoiceName = accessStore.edgeVoiceName();
        const tts = new MsEdgeTTS();
        await tts.setMetadata(
          edgeVoiceName,
          OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
        );
        audioBuffer = await tts.toArrayBuffer(textContent);
      } else {
        audioBuffer = await api.llm.speech({
          model: config.ttsConfig.model,
          input: textContent,
          voice: config.ttsConfig.voice,
          speed: config.ttsConfig.speed,
        });
      }
      setSpeechStatus(true);
      ttsPlayer
        .play(audioBuffer, () => {
          setSpeechStatus(false);
        })
        .catch((e) => {
          console.error("[OpenAI Speech]", e);
          showToast(prettyObject(e));
          setSpeechStatus(false);
        })
        .finally(() => setSpeechLoading(false));
    }
  }

  const context: RenderMessage[] = useMemo(() => {
    return session.mask.hideContext ? [] : session.mask.context.slice();
  }, [session.mask.context, session.mask.hideContext]);

  if (
    context.length === 0 &&
    session.messages.at(0)?.content !== BOT_HELLO.content
  ) {
    const copiedHello = Object.assign({}, BOT_HELLO);
    if (!accessStore.isAuthorized()) {
      copiedHello.content = Locale.Error.Unauthorized;
    }
    context.push(copiedHello);
  }

  // preview messages
  const renderMessages = useMemo(() => {
    return context
      .concat(session.messages as RenderMessage[])
      .concat(
        isLoading
          ? [
              {
                ...createMessage({
                  role: "assistant",
                  content: "……",
                }),
                preview: true,
              },
            ]
          : [],
      )
      .concat(
        userInput.length > 0 && config.sendPreviewBubble
          ? [
              {
                ...createMessage({
                  role: "user",
                  content: userInput,
                }),
                preview: true,
              },
            ]
          : [],
      );
  }, [
    config.sendPreviewBubble,
    context,
    isLoading,
    session.messages,
    userInput,
  ]);

  const [msgRenderIndex, _setMsgRenderIndex] = useState(
    Math.max(0, renderMessages.length - CHAT_PAGE_SIZE),
  );

  function setMsgRenderIndex(newIndex: number) {
    newIndex = Math.min(renderMessages.length - CHAT_PAGE_SIZE, newIndex);
    newIndex = Math.max(0, newIndex);
    _setMsgRenderIndex(newIndex);
  }

  const messages = useMemo(() => {
    const endRenderIndex = Math.min(
      msgRenderIndex + 3 * CHAT_PAGE_SIZE,
      renderMessages.length,
    );
    return renderMessages.slice(msgRenderIndex, endRenderIndex);
  }, [msgRenderIndex, renderMessages]);

  const onChatBodyScroll = (e: HTMLElement) => {
    const bottomHeight = e.scrollTop + e.clientHeight;
    const edgeThreshold = e.clientHeight;

    const isTouchTopEdge = e.scrollTop <= edgeThreshold;
    const isTouchBottomEdge = bottomHeight >= e.scrollHeight - edgeThreshold;
    const isHitBottom =
      bottomHeight >= e.scrollHeight - (isMobileScreen ? 4 : 10);

    const prevPageMsgIndex = msgRenderIndex - CHAT_PAGE_SIZE;
    const nextPageMsgIndex = msgRenderIndex + CHAT_PAGE_SIZE;

    if (isTouchTopEdge && !isTouchBottomEdge) {
      setMsgRenderIndex(prevPageMsgIndex);
    } else if (isTouchBottomEdge) {
      setMsgRenderIndex(nextPageMsgIndex);
    }

    setHitBottom(isHitBottom);
    setAutoScroll(isHitBottom);
  };

  function scrollToBottom() {
    setMsgRenderIndex(renderMessages.length - CHAT_PAGE_SIZE);
    scrollDomToBottom();
  }

  // clear context index = context length + index in messages
  const clearContextIndex =
    (session.clearContextIndex ?? -1) >= 0
      ? session.clearContextIndex! + context.length - msgRenderIndex
      : -1;

  const [showPromptModal, setShowPromptModal] = useState(false);

  const clientConfig = useMemo(() => getClientConfig(), []);

  const autoFocus = !isMobileScreen; // wont auto focus on mobile screen
  const showMaxIcon = !isMobileScreen && !clientConfig?.isApp;

  useCommand({
    fill: setUserInput,
    submit: (text) => {
      doSubmit(text);
    },
    code: (text) => {
      if (accessStore.disableFastLink) return;
      console.log("[Command] got code from url: ", text);
      showConfirm(Locale.URLCommand.Code + `code = ${text}`).then((res) => {
        if (res) {
          accessStore.update((access) => (access.accessCode = text));
        }
      });
    },
    settings: (text) => {
      if (accessStore.disableFastLink) return;

      try {
        const payload = JSON.parse(text) as {
          key?: string;
          url?: string;
        };

        console.log("[Command] got settings from url: ", payload);

        if (payload.key || payload.url) {
          showConfirm(
            Locale.URLCommand.Settings +
              `\n${JSON.stringify(payload, null, 4)}`,
          ).then((res) => {
            if (!res) return;
            if (payload.key) {
              accessStore.update(
                (access) => (access.openaiApiKey = payload.key!),
              );
            }
            if (payload.url) {
              accessStore.update((access) => (access.openaiUrl = payload.url!));
            }
            accessStore.update((access) => (access.useCustomConfig = true));
          });
        }
      } catch {
        console.error("[Command] failed to get settings from url: ", text);
      }
    },
  });

  // edit / insert message modal
  const [isEditingMessage, setIsEditingMessage] = useState(false);

  // remember unfinished input
  useEffect(() => {
    // try to load from local storage
    const key = UNFINISHED_INPUT(session.id);
    const mayBeUnfinishedInput = localStorage.getItem(key);
    if (mayBeUnfinishedInput && userInput.length === 0) {
      setUserInput(mayBeUnfinishedInput);
      localStorage.removeItem(key);
    }

    const dom = inputRef.current;
    return () => {
      localStorage.setItem(key, dom?.value ?? "");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 代码检测函数
  const detectCodeLanguage = (text: string): string | null => {
    // 检测各种编程语言的特征
    const languagePatterns: Record<string, RegExp> = {
      // 明确类型
      javascript:
        /(?:function\s+\w+|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=|\.then\(|\.catch\(|console\.log|document\.|window\.|=>)/i,
      typescript:
        /(?:interface\s+\w+|type\s+\w+\s*=|enum\s+\w+|export\s+(?:interface|type|enum)|:\s*string|:\s*number|:\s*boolean)/i,
      python:
        /(?:def\s+\w+|class\s+\w+|import\s+\w+|from\s+\w+\s+import|print\(|if\s+__name__\s*==)/i, // 移除了 .py$
      java: /(?:public\s+class|private\s+\w+|public\s+static\s+void\s+main|System\.out\.println|@Override|extends\s+\w+)/i,
      cpp: /(?:#include\s*<|std::|cout\s*<<|cin\s*>>|nullptr|class\s+\w+.*{|public:|private:|protected:)/i,
      csharp:
        /(?:using\s+System|public\s+class\s+\w+|Console\.WriteLine|namespace\s+\w+|var\s+\w+\s*=.*new)/i,
      html: /(?:<\/?\w+(?:\s+\w+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+))?)*\s*\/?>|<!DOCTYPE|<html|<head|<body)/i,
      css: /(?:\w+\s*{\s*[\w-]+\s*:\s*[^}]+}|@media\s*\([^)]+\)|\.[\w-]+\s*{|#[\w-]+\s*{)/i,
      sql: /(?:SELECT\s+.*\s+FROM|INSERT\s+INTO|UPDATE\s+.*\s+SET|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE)/i,
      json: /^\s*[\{\[].*[\}\]]\s*$/s, // 确保匹配多行
      yaml: /(?:^[\s]*[\w-]+\s*:\s*(?:[^\r\n]+|$))/m,
      markdown:
        /(?:^#{1,6}\s+|^\s*[\*\-\+]\s+|^\s*\d+\.\s+|\[.+\]\(.+\)|`{1,3}[\s\S]*?`{1,3})/m,
      xml: /(?:<\?xml|<\/?\w+(?:\s+\w+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*\s*\/?>)/i,
      shell:
        /(?:^[\s]*[$#]\s*|grep\s+|find\s+|awk\s+|sed\s+|chmod\s+|sudo\s+|apt\s+install|npm\s+install)/m,
      php: /(?:<\?php|\$\w+\s*=|function\s+\w+\s*\(|echo\s+|require_once|include_once)/i,
      ruby: /(?:def\s+\w+|class\s+\w+|require\s+|puts\s+|end$|\.each\s+do)/i,
      go: /(?:package\s+\w+|import\s+\(|func\s+\w+|var\s+\w+\s+\w+|fmt\.Print)/i,
      rust: /(?:fn\s+\w+|let\s+mut\s+|println!|use\s+std::|struct\s+\w+|impl\s+\w+)/i,
      swift:
        /(?:func\s+\w+|var\s+\w+:\s*\w+|let\s+\w+\s*=|import\s+\w+|class\s+\w+:\s*\w+)/i,
      kotlin:
        /(?:fun\s+\w+|val\s+\w+\s*=|var\s+\w+:\s*\w+|class\s+\w+|import\s+\w+)/i,
    };

    const codeIndicators = [
      /{\s*[\r\n][\s\S]*?[\r\n]\s*}/,
      /[\w\s]*\([^)]*\)\s*{/,
      /\w+\s*=\s*[^;]+;/,
      /if\s*\([^)]+\)\s*{/,
      /for\s*\([^)]*\)\s*{/,
      /\/\/.*$|\/\*[\s\S]*?\*\//m,
      /^\s*[\w-]+:\s*[^;\r\n]+;?\s*$/m,
      /^\s*<[\w\s="'-\/]+>\s*$/m,
    ];

    for (const [language, pattern] of Object.entries(languagePatterns)) {
      if (pattern.test(text)) {
        return language;
      }
    }

    let codeScore = 0;
    for (const pattern of codeIndicators) {
      if (pattern.test(text)) {
        codeScore++;
      }
    }
    // 降低通用代码的判断阈值，或者增加更多通用指示器
    if (codeScore >= 1 && text.length > 20) {
      // 例如：至少一个通用指示器且文本长度大于20
      return "code";
    }

    return null;
  };

  const handlePaste = useCallback(
    async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = (event.clipboardData || window.clipboardData).items;
      const newFilesToProcess: File[] = [];
      let plainTextItemFound = false;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            newFilesToProcess.push(file);
          }
        } else if (
          item.kind === "string" &&
          item.type.startsWith("text/plain")
        ) {
          plainTextItemFound = true;
        }
      }

      if (newFilesToProcess.length > 0) {
        event.preventDefault();
        setUploading(true);
        const dataUrlPromises: Promise<string>[] = [];

        for (const file of newFilesToProcess) {
          if (file.type.startsWith("image/")) {
            // 处理图片文件
            dataUrlPromises.push(uploadImageRemote(file));
          } else if (
            file.name.endsWith(".xlsx") ||
            file.name.endsWith(".xls") ||
            file.type === "application/vnd.ms-excel" ||
            file.type ===
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          ) {
            // --- 处理 Excel 文件 ---
            const promise = new Promise<string>((resolveFile, rejectFile) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                try {
                  const arrayBuffer = e.target?.result as ArrayBuffer;
                  const workbook = XLSX.read(arrayBuffer, { type: "array" });
                  let fullTextContent = "";

                  workbook.SheetNames.forEach((sheetName) => {
                    const worksheet = workbook.Sheets[sheetName];
                    // XLSX.utils.sheet_to_txt 会将单元格内容用制表符分隔，行用换行符分隔
                    const sheetText = XLSX.utils.sheet_to_txt(worksheet, {
                      FS: "\t",
                      RS: "\n",
                    });
                    fullTextContent += `--- Sheet: ${sheetName} ---\n${sheetText}\n\n`;
                  });

                  if (fullTextContent.trim() === "") {
                    fullTextContent = "[Empty Excel File]";
                  }

                  // 将提取的文本内容编码为 Base64 Data URL
                  const mimeType = "text/plain"; // 我们发送的是纯文本内容
                  const utf8Encoder = new TextEncoder();
                  const uint8Array = utf8Encoder.encode(fullTextContent);
                  let binaryString = "";
                  for (let j = 0; j < uint8Array.length; j++) {
                    binaryString += String.fromCharCode(uint8Array[j]);
                  }
                  const base64Encoded = btoa(binaryString);
                  resolveFile(
                    `data:${mimeType};name=${encodeURIComponent(
                      file.name,
                    )};base64,${base64Encoded}`,
                  );
                } catch (err) {
                  console.error(
                    "Error processing pasted Excel file:",
                    file.name,
                    err,
                  );
                  rejectFile(
                    new Error(
                      `Error processing Excel file ${file.name}: ${
                        (err as Error).message
                      }`,
                    ),
                  );
                }
              };
              reader.onerror = (err) => {
                console.error(
                  "Error reading pasted Excel file:",
                  file.name,
                  err,
                );
                rejectFile(new Error(`Error reading Excel file ${file.name}`));
              };
              reader.readAsArrayBuffer(file); // <--- 读取为 ArrayBuffer 给 SheetJS
            });
            dataUrlPromises.push(promise);
          } else {
            // 处理其他文本文件
            const promise = new Promise<string>((resolveFile, rejectFile) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                try {
                  const textContentFromFile = e.target?.result as string;
                  const mimeType = file.type || "application/octet-stream";
                  const utf8Encoder = new TextEncoder();
                  const uint8Array = utf8Encoder.encode(textContentFromFile);
                  let binaryString = "";
                  for (let j = 0; j < uint8Array.length; j++) {
                    binaryString += String.fromCharCode(uint8Array[j]);
                  }
                  const base64Encoded = btoa(binaryString);
                  resolveFile(
                    `data:${mimeType};name=${encodeURIComponent(
                      file.name,
                    )};base64,${base64Encoded}`,
                  );
                } catch (err) {
                  console.error(
                    "Error processing pasted file to Data URL:",
                    file.name,
                    err,
                  );
                  rejectFile(
                    new Error(
                      `Error processing pasted file ${file.name}: ${
                        (err as Error).message
                      }`,
                    ),
                  );
                }
              };
              reader.onerror = (err) => {
                console.error("Error reading pasted file:", file.name, err);
                rejectFile(new Error(`Error reading pasted file ${file.name}`));
              };
              reader.readAsText(file);
            });
            dataUrlPromises.push(promise);
          }
        }

        try {
          const resolvedDataUrls = await Promise.all(dataUrlPromises);
          const currentAttachImages = [...attachImages];
          currentAttachImages.push(...resolvedDataUrls.filter((url) => url));

          const MAX_ATTACHMENTS = 3;
          if (currentAttachImages.length > MAX_ATTACHMENTS) {
            currentAttachImages.splice(
              MAX_ATTACHMENTS,
              currentAttachImages.length - MAX_ATTACHMENTS,
            );
            showToast(
              Locale.Chat.AttachmentLimitExceeded ||
                `Cannot attach more than ${MAX_ATTACHMENTS} files.`,
            );
          }
          setAttachImages(currentAttachImages);

          // 根据文件类型显示不同的提示信息
          const excelFileCount = newFilesToProcess.filter(
            (file) =>
              file.name.endsWith(".xlsx") ||
              file.name.endsWith(".xls") ||
              file.type === "application/vnd.ms-excel" ||
              file.type ===
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          ).length;

          if (excelFileCount > 0) {
            showToast(
              `Successfully processed ${excelFileCount} Excel file(s).`,
            );
          } else {
            showToast("Files have been attached successfully.");
          }
        } catch (error) {
          console.error("Error processing pasted files:", error);
          showToast(
            Locale.Chat.UploadFileError || "Error processing pasted files.",
          );
        } finally {
          setUploading(false);
        }
      } else if (plainTextItemFound) {
        event.preventDefault();

        const pastedTextContent = await new Promise<string>((resolve) => {
          for (let i = 0; i < items.length; i++) {
            if (
              items[i].kind === "string" &&
              items[i].type.startsWith("text/plain")
            ) {
              items[i].getAsString(resolve);
              return;
            }
          }
          resolve("");
        });

        if (!pastedTextContent) return;

        const detectedLanguage = detectCodeLanguage(pastedTextContent);
        const TEXT_TO_FILE_THRESHOLD = 3000; // 长文本转文件的阈值
        const CODE_TO_MARKDOWN_MIN_LENGTH = 10; // 代码转 markdown 的最小长度，避免太短的也转

        if (
          detectedLanguage &&
          pastedTextContent.length >= CODE_TO_MARKDOWN_MIN_LENGTH
        ) {
          if (pastedTextContent.length > TEXT_TO_FILE_THRESHOLD) {
            // 长代码：转换为文件
            setUploading(true);
            try {
              const fileExtension =
                detectedLanguage === "code" ? "txt" : detectedLanguage;
              const fileName = `pasted_code_${Date.now()}.${fileExtension}`;
              const mimeType = "text/plain"; // 文件内容本身是文本
              const utf8Encoder = new TextEncoder();
              const uint8Array = utf8Encoder.encode(pastedTextContent);
              let binaryString = "";
              for (let j = 0; j < uint8Array.length; j++) {
                binaryString += String.fromCharCode(uint8Array[j]);
              }
              const base64Encoded = btoa(binaryString);
              const dataUrl = `data:${mimeType};name=${encodeURIComponent(
                fileName,
              )};base64,${base64Encoded}`;

              const currentAttachImages = [...attachImages];
              currentAttachImages.push(dataUrl);

              const MAX_ATTACHMENTS = 3;
              if (currentAttachImages.length > MAX_ATTACHMENTS) {
                currentAttachImages.splice(
                  MAX_ATTACHMENTS,
                  currentAttachImages.length - MAX_ATTACHMENTS,
                );
                showToast(
                  Locale.Chat.AttachmentLimitExceeded ||
                    `Cannot attach more than ${MAX_ATTACHMENTS} files.`,
                );
              }
              setAttachImages(currentAttachImages);
              showToast(
                `Pasted ${detectedLanguage} code was attached as a file.`,
              );
            } catch (error) {
              console.error("Error converting pasted code to file:", error);
              showToast(
                Locale.Chat.UploadFileError || "Error processing pasted code.",
              );
            } finally {
              setUploading(false);
            }
          } else {
            // 短代码：用 markdown 格式插入到输入框
            const languageHint =
              detectedLanguage === "code" ? "" : detectedLanguage;
            const markdownCode = `\`\`\`${languageHint}\n${pastedTextContent}\n\`\`\``;

            const target = event.target as HTMLTextAreaElement;
            const currentValue = target.value;
            const selectionStart = target.selectionStart;
            const selectionEnd = target.selectionEnd;

            const newValue =
              currentValue.slice(0, selectionStart) +
              markdownCode +
              currentValue.slice(selectionEnd);

            setUserInput(newValue);

            setTimeout(() => {
              if (inputRef.current) {
                const newCursorPosition = selectionStart + markdownCode.length;
                inputRef.current.setSelectionRange(
                  newCursorPosition,
                  newCursorPosition,
                );
                inputRef.current.focus();
              }
            }, 0);

            showToast(`Pasted ${detectedLanguage} code formatted as markdown.`);
          }
        } else if (pastedTextContent.length > TEXT_TO_FILE_THRESHOLD) {
          // 非代码的长文本：转换为文件
          setUploading(true);
          try {
            const fileName = `pasted_text_${Date.now()}.txt`;
            const mimeType = "text/plain";
            const utf8Encoder = new TextEncoder();
            const uint8Array = utf8Encoder.encode(pastedTextContent);
            let binaryString = "";
            for (let j = 0; j < uint8Array.length; j++) {
              binaryString += String.fromCharCode(uint8Array[j]);
            }
            const base64Encoded = btoa(binaryString);
            const dataUrl = `data:${mimeType};name=${encodeURIComponent(
              fileName,
            )};base64,${base64Encoded}`;

            const currentAttachImages = [...attachImages];
            currentAttachImages.push(dataUrl);

            const MAX_ATTACHMENTS = 3;
            if (currentAttachImages.length > MAX_ATTACHMENTS) {
              currentAttachImages.splice(
                MAX_ATTACHMENTS,
                currentAttachImages.length - MAX_ATTACHMENTS,
              );
              showToast(
                Locale.Chat.AttachmentLimitExceeded ||
                  `Cannot attach more than ${MAX_ATTACHMENTS} files.`,
              );
            }
            setAttachImages(currentAttachImages);
            showToast(
              Locale.Chat.PastedTextAsFile ||
                "Pasted text was attached as a file.",
            );
          } catch (error) {
            console.error("Error converting pasted text to file:", error);
            showToast(
              Locale.Chat.UploadFileError || "Error processing pasted text.",
            );
          } finally {
            setUploading(false);
          }
        } else {
          // 短的非代码文本：手动插入到输入框
          const target = event.target as HTMLTextAreaElement;
          const currentValue = target.value;
          const selectionStart = target.selectionStart;
          const selectionEnd = target.selectionEnd;

          const newValue =
            currentValue.slice(0, selectionStart) +
            pastedTextContent +
            currentValue.slice(selectionEnd);

          setUserInput(newValue);

          setTimeout(() => {
            if (inputRef.current) {
              const newCursorPosition =
                selectionStart + pastedTextContent.length;
              inputRef.current.setSelectionRange(
                newCursorPosition,
                newCursorPosition,
              );
              inputRef.current.focus();
            }
          }, 0);
        }
      }
    },
    [
      attachImages,
      setAttachImages,
      setUploading,
      Locale,
      inputRef,
      setUserInput,
    ],
  );

  const getAttachmentInfo = (
    dataUrl: string,
  ): {
    isImage: boolean;
    name: string;
    url: string;
    isTextFile: boolean;
    fileExtension: string;
  } => {
    let isImage = false;
    let name = "unknown_file";
    let isTextFile = false;
    let fileExtension = "";

    const imageExtensions = /\.(jpeg|jpg|gif|png|webp|svg|heic|heif)$/i;
    const textFileExtensionsByName =
      /\.(txt|c|cpp|h|java|py|md|json|xml|html|css|js|ts|sh|bat)$/i;

    const extractExtension = (filename: string): string => {
      const lastDot = filename.lastIndexOf(".");
      if (lastDot === -1 || lastDot === 0 || lastDot === filename.length - 1) {
        return "";
      }
      return filename.substring(lastDot + 1).toLowerCase();
    };

    if (dataUrl.startsWith("data:")) {
      const dataUrlParts = dataUrl.substring(5).split(";");
      const mimeType = dataUrlParts[0].toLowerCase();
      let parsedNameFromDataUrl = "";

      for (const part of dataUrlParts) {
        if (part.startsWith("name=")) {
          try {
            parsedNameFromDataUrl = decodeURIComponent(part.substring(5));
            break;
          } catch (e) {
            console.error(
              "Error decoding filename from data: URL part",
              part,
              e,
            );
          }
        }
      }
      name = parsedNameFromDataUrl || "attachment";
      fileExtension = extractExtension(name);

      if (mimeType.startsWith("image/")) {
        isImage = true;
        if (!parsedNameFromDataUrl) name = "image_data_attachment";
      } else if (mimeType.startsWith("text/")) {
        isTextFile = true;
        if (!parsedNameFromDataUrl) name = "text_data_attachment";
      } else if (
        mimeType === "application/octet-stream" &&
        parsedNameFromDataUrl &&
        textFileExtensionsByName.test(parsedNameFromDataUrl)
      ) {
        isTextFile = true;
      } else if (
        parsedNameFromDataUrl &&
        textFileExtensionsByName.test(parsedNameFromDataUrl)
      ) {
        isTextFile = true;
      }

      if (isImage) {
        isTextFile = false;
      }
    } else if (
      dataUrl.startsWith("http:") ||
      dataUrl.startsWith("https://") ||
      dataUrl.startsWith("blob:")
    ) {
      try {
        const urlObj = new URL(dataUrl);
        const pathParts = urlObj.pathname.split("/");
        const potentialName = decodeURIComponent(
          pathParts[pathParts.length - 1],
        );
        if (potentialName) {
          name = potentialName;
        } else if (dataUrl.startsWith("blob:")) {
          name = "blob_attachment";
        } else {
          name = "url_attachment";
        }
      } catch (e) {
        const simpleParts = dataUrl.split("/");
        const lastSegment = simpleParts[simpleParts.length - 1];
        try {
          name =
            decodeURIComponent(lastSegment.split("?")[0].split("#")[0]) ||
            (dataUrl.startsWith("blob:")
              ? "blob_attachment"
              : "url_attachment");
        } catch (decodeError) {
          name = dataUrl.startsWith("blob:")
            ? "blob_attachment"
            : "url_attachment";
          console.error(
            "Error decoding filename from URL segment",
            lastSegment,
            decodeError,
          );
        }
      }
      fileExtension = extractExtension(name);

      if (imageExtensions.test(name) || imageExtensions.test(dataUrl)) {
        isImage = true;
      }
      if (!isImage && textFileExtensionsByName.test(name)) {
        isTextFile = true;
      }
    }

    return { isImage, name, url: dataUrl, isTextFile, fileExtension };
  };

  async function uploadImage() {
    const currentAttachImages = [...attachImages]; // 使用 useState 的 attachImages

    try {
      const selectedFilesDataUrls = await new Promise<string[]>(
        (resolve, reject) => {
          const fileInput = document.createElement("input");
          fileInput.type = "file";
          fileInput.accept =
            "image/png, image/jpeg, image/webp, image/heic, image/heif, .txt, .c, .cpp, .h, .java, .py, .md, .json, .xml, .html, .css, .js, .ts, .sh, .bat, text/plain, application/octet-stream, .xlsx, .xls, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          fileInput.multiple = true;

          fileInput.onchange = async (event: any) => {
            setUploading(true);
            const files = event.target.files;
            if (!files || files.length === 0) {
              setUploading(false);
              resolve([]);
              return;
            }

            const fileProcessingPromises: Promise<string>[] = [];

            for (let i = 0; i < files.length; i++) {
              const file = files[i] as File; // 类型断言
              if (file.type.startsWith("image/")) {
                fileProcessingPromises.push(uploadImageRemote(file));
              } else if (
                file.name.endsWith(".xlsx") ||
                file.name.endsWith(".xls") ||
                file.type === "application/vnd.ms-excel" ||
                file.type ===
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              ) {
                // --- 处理 Excel 文件 ---
                const promise = new Promise<string>(
                  (resolveFile, rejectFile) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      try {
                        const arrayBuffer = e.target?.result as ArrayBuffer;
                        const workbook = XLSX.read(arrayBuffer, {
                          type: "array",
                        });
                        let fullTextContent = "";

                        workbook.SheetNames.forEach((sheetName) => {
                          const worksheet = workbook.Sheets[sheetName];
                          // XLSX.utils.sheet_to_txt 会将单元格内容用制表符分隔，行用换行符分隔
                          const sheetText = XLSX.utils.sheet_to_txt(worksheet, {
                            FS: "\t",
                            RS: "\n",
                          });
                          fullTextContent += `--- Sheet: ${sheetName} ---\n${sheetText}\n\n`;
                        });

                        if (fullTextContent.trim() === "") {
                          fullTextContent = "[Empty Excel File]";
                        }

                        // 将提取的文本内容编码为 Base64 Data URL
                        const mimeType = "text/plain"; // 我们发送的是纯文本内容
                        const utf8Encoder = new TextEncoder();
                        const uint8Array = utf8Encoder.encode(fullTextContent);
                        let binaryString = "";
                        for (let j = 0; j < uint8Array.length; j++) {
                          binaryString += String.fromCharCode(uint8Array[j]);
                        }
                        const base64Encoded = btoa(binaryString);
                        resolveFile(
                          `data:${mimeType};name=${encodeURIComponent(
                            file.name,
                          )};base64,${base64Encoded}`,
                        );
                      } catch (err) {
                        console.error(
                          "Error processing Excel file:",
                          file.name,
                          err,
                        );
                        rejectFile(
                          new Error(
                            `Error processing Excel file ${file.name}: ${
                              (err as Error).message
                            }`,
                          ),
                        );
                      }
                    };
                    reader.onerror = (err) => {
                      console.error(
                        "Error reading Excel file:",
                        file.name,
                        err,
                      );
                      rejectFile(
                        new Error(`Error reading Excel file ${file.name}`),
                      );
                    };
                    reader.readAsArrayBuffer(file); // <--- 读取为 ArrayBuffer 给 SheetJS
                  },
                );
                fileProcessingPromises.push(promise);
              } else {
                // 其他文本文件等按原逻辑处理
                const promise = new Promise<string>(
                  (resolveFile, rejectFile) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      try {
                        const textContentFromFile = e.target?.result as string;
                        const mimeType =
                          file.type || "application/octet-stream";
                        const utf8Encoder = new TextEncoder();
                        const uint8Array =
                          utf8Encoder.encode(textContentFromFile);
                        let binaryString = "";
                        for (let j = 0; j < uint8Array.length; j++) {
                          binaryString += String.fromCharCode(uint8Array[j]);
                        }
                        const base64Encoded = btoa(binaryString);
                        resolveFile(
                          `data:${mimeType};name=${encodeURIComponent(
                            file.name,
                          )};base64,${base64Encoded}`,
                        );
                      } catch (err) {
                        /* ... */
                      }
                    };
                    reader.onerror = (err) => {
                      /* ... */
                    };
                    reader.readAsText(file);
                  },
                );
                fileProcessingPromises.push(promise);
              }
            }

            try {
              const dataUrls = await Promise.all(fileProcessingPromises);
              resolve(dataUrls.filter((url) => url));
            } catch (error) {
              console.error(
                "Error processing one or more files in uploadImage promise:",
                error,
              );
              showToast(
                Locale.Chat.UploadFileError || "Error processing files.",
              );
              reject(error);
            } finally {
              setUploading(false);
            }
          };
          fileInput.onerror = (errEvent) => {
            setUploading(false);
            console.error("File input error:", errEvent);
            reject(new Error("File input failed"));
          };
          fileInput.click();
        },
      );

      const allSelectedDataUrls = [
        ...currentAttachImages,
        ...selectedFilesDataUrls,
      ];
      const MAX_ATTACHMENTS = 5;
      if (allSelectedDataUrls.length > MAX_ATTACHMENTS) {
        allSelectedDataUrls.splice(
          MAX_ATTACHMENTS,
          allSelectedDataUrls.length - MAX_ATTACHMENTS,
        );
        showToast(
          Locale.Chat.AttachmentLimitExceeded ||
            `Cannot attach more than ${MAX_ATTACHMENTS} files.`,
        );
      }
      setAttachImages(allSelectedDataUrls);
    } catch (error) {
      console.error(
        "File selection or initial processing failed in uploadImage:",
        error,
      );
      setUploading(false);
      showToast(Locale.Chat.UploadFileError || "Error during file selection.");
    }
  }

  // 快捷键 shortcut keys
  const [showShortcutKeyModal, setShowShortcutKeyModal] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 打开新聊天 command + shift + o
      if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "o"
      ) {
        event.preventDefault();
        setTimeout(() => {
          chatStore.newSession();
          navigate(Path.Chat);
        }, 10);
      }
      // 聚焦聊天输入 shift + esc
      else if (event.shiftKey && event.key.toLowerCase() === "escape") {
        event.preventDefault();
        inputRef.current?.focus();
      }
      // 复制最后一个代码块 command + shift + ;
      else if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.code === "Semicolon"
      ) {
        event.preventDefault();
        const copyCodeButton =
          document.querySelectorAll<HTMLElement>(".copy-code-button");
        if (copyCodeButton.length > 0) {
          copyCodeButton[copyCodeButton.length - 1].click();
        }
      }
      // 复制最后一个回复 command + shift + c
      else if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "c"
      ) {
        event.preventDefault();
        const lastNonUserMessage = messages
          .filter((message) => message.role !== "user")
          .pop();
        if (lastNonUserMessage) {
          const lastMessageContent = getMessageTextContent(lastNonUserMessage);
          copyToClipboard(lastMessageContent);
        }
      }
      // 展示快捷键 command + /
      else if ((event.metaKey || event.ctrlKey) && event.key === "/") {
        event.preventDefault();
        setShowShortcutKeyModal(true);
      }
      // 清除上下文 command + shift + backspace
      else if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "backspace"
      ) {
        event.preventDefault();
        chatStore.updateTargetSession(session, (session) => {
          if (session.clearContextIndex === session.messages.length) {
            session.clearContextIndex = undefined;
          } else {
            session.clearContextIndex = session.messages.length;
            session.memoryPrompt = ""; // will clear memory
          }
        });
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [messages, chatStore, navigate, session]);

  const [showChatSidePanel, setShowChatSidePanel] = useState(false);

  return (
    <>
      <div className={styles.chat} key={session.id}>
        <div className="window-header" data-tauri-drag-region>
          {isMobileScreen && (
            <div className="window-actions">
              <div className={"window-action-button"}>
                <IconButton
                  icon={<ReturnIcon />}
                  bordered
                  title={Locale.Chat.Actions.ChatList}
                  onClick={() => navigate(Path.Home)}
                />
              </div>
            </div>
          )}

          <div
            className={clsx("window-header-title", styles["chat-body-title"])}
          >
            <div
              className={clsx(
                "window-header-main-title",
                styles["chat-body-main-title"],
              )}
              onClickCapture={() => setIsEditingMessage(true)}
            >
              {!session.topic ? DEFAULT_TOPIC : session.topic}
            </div>
            <div className="window-header-sub-title">
              {Locale.Chat.SubTitle(session.messages.length)}
            </div>
          </div>
          <div className="window-actions">
            <div className="window-action-button">
              <IconButton
                icon={<ReloadIcon />}
                bordered
                title={Locale.Chat.Actions.RefreshTitle}
                onClick={() => {
                  showToast(Locale.Chat.Actions.RefreshToast);
                  chatStore.summarizeSession(true, session);
                }}
              />
            </div>
            {!isMobileScreen && (
              <div className="window-action-button">
                <IconButton
                  icon={<RenameIcon />}
                  bordered
                  title={Locale.Chat.EditMessage.Title}
                  aria={Locale.Chat.EditMessage.Title}
                  onClick={() => setIsEditingMessage(true)}
                />
              </div>
            )}
            <div className="window-action-button">
              <IconButton
                icon={<ExportIcon />}
                bordered
                title={Locale.Chat.Actions.Export}
                onClick={() => {
                  setShowExport(true);
                }}
              />
            </div>
            {showMaxIcon && (
              <div className="window-action-button">
                <IconButton
                  icon={config.tightBorder ? <MinIcon /> : <MaxIcon />}
                  bordered
                  title={Locale.Chat.Actions.FullScreen}
                  aria={Locale.Chat.Actions.FullScreen}
                  onClick={() => {
                    config.update(
                      (config) => (config.tightBorder = !config.tightBorder),
                    );
                  }}
                />
              </div>
            )}
          </div>

          <PromptToast
            showToast={!hitBottom}
            showModal={showPromptModal}
            setShowModal={setShowPromptModal}
          />
        </div>
        <div className={styles["chat-main"]}>
          <div className={styles["chat-body-container"]}>
            <div
              className={styles["chat-body"]}
              ref={scrollRef}
              onScroll={(e) => onChatBodyScroll(e.currentTarget)}
              onMouseDown={() => inputRef.current?.blur()}
              onTouchStart={() => {
                inputRef.current?.blur();
                setAutoScroll(false);
              }}
            >
              {messages.map((message, i) => {
                const isUser = message.role === "user";
                const isContext = i < context.length; // context 是 useMemo 计算出来的
                const showActions =
                  i > 0 && // 条件1: 必须不是第一条消息 (索引大于0)
                  !message.preview && // 条件2: 消息不能是预览消息
                  (getMessageTextContent(message).length > 0 ||
                    (message.attachments && message.attachments.length > 0)); // 条件3: 消息必须有文本内容或附件
                // console.log(
                //   `Message ID: ${message.id}, Index: ${i}, Role: ${message.role}`,
                //   `Is Preview: ${message.preview}`,
                //   `Is Streaming: ${message.streaming}`,
                //   `Is Context: ${isContext}`,
                //   `Text Content Length: ${getMessageTextContent(message).length}`,
                //   `Attachments Length: ${message.attachments?.length || 0}`,
                //   `Calculated showActions: ${showActions}`
                // );
                const showTyping = message.preview || message.streaming;

                const shouldShowClearContextDivider =
                  i === clearContextIndex - 1;

                return (
                  <Fragment key={message.id || `msg-${i}`}>
                    {" "}
                    {/* 确保有 key */}
                    <div
                      className={
                        isUser
                          ? styles["chat-message-user"]
                          : styles["chat-message"]
                      }
                    >
                      <div className={styles["chat-message-container"]}>
                        <div className={styles["chat-message-header"]}>
                          {/* ... (头像, 编辑按钮, 模型名称等头部信息保持不变) ... */}
                          <div className={styles["chat-message-avatar"]}>
                            <div className={styles["chat-message-edit"]}>
                              <IconButton
                                icon={<EditIcon />}
                                aria={Locale.Chat.Actions.Edit}
                                onClick={async () => {
                                  // ... (编辑消息逻辑) ...
                                  // 注意：如果编辑消息时也允许修改附件，这里的逻辑会更复杂
                                  const newMessageContent = await showPrompt(
                                    Locale.Chat.Actions.Edit,
                                    getMessageTextContent(message), // 只编辑文本部分
                                    10,
                                  );
                                  // 更新消息时，只更新文本内容，保持附件不变
                                  // 或者提供更复杂的附件编辑界面
                                  chatStore.updateTargetSession(
                                    session,
                                    (s) => {
                                      const msgToUpdate = s.mask.context
                                        .concat(s.messages)
                                        .find((m) => m.id === message.id);
                                      if (msgToUpdate) {
                                        if (
                                          typeof msgToUpdate.content ===
                                          "string"
                                        ) {
                                          msgToUpdate.content =
                                            newMessageContent;
                                        } else {
                                          // Multimodal content
                                          const textPart =
                                            msgToUpdate.content.find(
                                              (p) => p.type === "text",
                                            );
                                          if (textPart) {
                                            textPart.text = newMessageContent;
                                          } else {
                                            // 如果没有文本部分，可能需要添加一个新的文本部分
                                            // 或者决定如何处理这种情况
                                            (
                                              msgToUpdate.content as MultimodalContent[]
                                            ).unshift({
                                              type: "text",
                                              text: newMessageContent,
                                            });
                                          }
                                        }
                                      }
                                    },
                                  );
                                }}
                              ></IconButton>
                            </div>
                            {isUser ? (
                              <Avatar avatar={config.avatar} />
                            ) : (
                              <>
                                {["system"].includes(message.role) ? (
                                  <Avatar avatar="2699-fe0f" />
                                ) : (
                                  <MaskAvatar
                                    avatar={session.mask.avatar}
                                    model={
                                      message.model ||
                                      session.mask.modelConfig.model
                                    }
                                  />
                                )}
                              </>
                            )}
                          </div>
                          {!isUser &&
                            message.model && ( // 确保 message.model 存在
                              <div className={styles["chat-model-name"]}>
                                {message.model}
                              </div>
                            )}
                          {showActions && (
                            <div className={styles["chat-message-actions"]}>
                              <div className={styles["chat-input-actions"]}>
                                {message.streaming ? (
                                  <ChatAction
                                    text={Locale.Chat.Actions.Stop}
                                    icon={<StopIcon />}
                                    onClick={() => onUserStop(message.id ?? i)}
                                  />
                                ) : (
                                  <>
                                    <ChatAction
                                      text={Locale.Chat.Actions.Retry}
                                      icon={<ResetIcon />}
                                      onClick={() => onResend(message)}
                                    />

                                    <ChatAction
                                      text={Locale.Chat.Actions.Delete}
                                      icon={<DeleteIcon />}
                                      onClick={() => onDelete(message.id ?? i)}
                                    />

                                    <ChatAction
                                      text={Locale.Chat.Actions.Pin}
                                      icon={<PinIcon />}
                                      onClick={() => onPinMessage(message)}
                                    />

                                    <ChatAction
                                      text={Locale.Chat.Actions.Copy}
                                      icon={<CopyIcon />}
                                      onClick={() =>
                                        copyToClipboard(
                                          getMessageTextContent(message),
                                        )
                                      }
                                    />

                                    {config.ttsConfig.enable && (
                                      <ChatAction
                                        text={
                                          speechStatus
                                            ? Locale.Chat.Actions.StopSpeech
                                            : Locale.Chat.Actions.Speech
                                        }
                                        icon={
                                          speechStatus ? (
                                            <SpeakStopIcon />
                                          ) : (
                                            <SpeakIcon />
                                          )
                                        }
                                        onClick={() =>
                                          openaiSpeech(
                                            getMessageTextContent(message),
                                          )
                                        }
                                      />
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {message?.tools?.length === 0 && showTyping && (
                          <div className={styles["chat-message-status"]}>
                            {Locale.Chat.Typing}
                          </div>
                        )}
                        {message?.tools && message.tools.length > 0 && (
                          <div className={styles["chat-message-tools"]}>
                            {message?.tools?.map((tool) => (
                              <div
                                key={tool.id}
                                title={tool?.errorMsg}
                                className={styles["chat-message-tool"]}
                              >
                                {tool.isError === false ? (
                                  <ConfirmIcon />
                                ) : tool.isError === true ? (
                                  <CloseIcon />
                                ) : (
                                  <LoadingButtonIcon />
                                )}
                                <span>{tool?.function?.name}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className={styles["chat-message-item"]}>
                          <Markdown
                            key={
                              message.streaming
                                ? `md-loading-${message.id}`
                                : `md-done-${message.id}`
                            }
                            content={getMessageTextContent(message)} // 获取消息的主要文本内容
                            loading={
                              (message.preview || message.streaming) &&
                              getMessageTextContent(message).length === 0 && // 只有在内容为空时才显示loading
                              !isUser
                            }
                            fontSize={fontSize}
                            fontFamily={fontFamily}
                            parentRef={scrollRef}
                            defaultShow={i >= messages.length - 6}
                          />

                          {/* --- 统一渲染所有附件 --- */}
                          {message.attachments &&
                            message.attachments.length > 0 && (
                              <div
                                className={
                                  styles["chat-message-attachments-container"]
                                }
                              >
                                {message.attachments.map((att, attIndex) => {
                                  if (att.type === "image" && att.url) {
                                    // 渲染图片附件
                                    // 你可以根据图片数量决定是单张显示还是多张网格显示
                                    // 这里简化为单张图片渲染，使用已有的样式
                                    return (
                                      <img
                                        key={`msg-${message.id}-att-img-${attIndex}`}
                                        className={
                                          styles["chat-message-item-image"]
                                        } // 或者一个新的特定于附件图片的样式
                                        src={att.url}
                                        alt={att.name || "Attached image"}
                                        onClick={() => {
                                          /* 可以在这里添加点击放大等交互 */
                                        }}
                                      />
                                    );
                                  } else if (
                                    att.type === "textfile" &&
                                    att.name
                                  ) {
                                    // 渲染文本文件附件预览
                                    // 使用 getAttachmentInfo 再次获取 fileExtension 是为了确保一致性，
                                    // 或者你可以在 MessageAttachment 接口中直接存储 fileExtension
                                    const ext =
                                      att.fileExtension ||
                                      att.name
                                        .substring(
                                          att.name.lastIndexOf(".") + 1,
                                        )
                                        .toLowerCase();
                                    return (
                                      <div
                                        key={`msg-${message.id}-att-file-${attIndex}`}
                                        className={
                                          styles[
                                            "chat-message-attachment-preview"
                                          ]
                                        }
                                        title={att.name}
                                      >
                                        <FileTextIcon />
                                        <span
                                          className={
                                            styles[
                                              "chat-message-attachment-name"
                                            ]
                                          }
                                        >
                                          {att.name}
                                        </span>
                                      </div>
                                    );
                                  }
                                  return null;
                                })}
                              </div>
                            )}
                          {/* --- 统一渲染所有附件结束 --- */}
                        </div>
                        {/* End of chat-message-item */}

                        {message?.audio_url && (
                          <div className={styles["chat-message-audio"]}>
                            <audio src={message.audio_url} controls />
                          </div>
                        )}

                        <div className={styles["chat-message-action-date"]}>
                          {isContext
                            ? Locale.Chat.IsContext
                            : message.date.toLocaleString()}
                        </div>
                      </div>
                      {/* End of chat-message-container */}
                    </div>
                    {/* End of chat-message or chat-message-user */}
                    {shouldShowClearContextDivider && <ClearContextDivider />}
                  </Fragment>
                );
              })}
            </div>
            {/* End of chat-body */}
            <div className={styles["chat-input-panel"]}>
              <PromptHints
                prompts={promptHints}
                onPromptSelect={onPromptSelect}
              />

              <ChatActions
                uploadImage={uploadImage}
                setAttachImages={setAttachImages}
                setUploading={setUploading}
                showPromptModal={() => setShowPromptModal(true)}
                scrollToBottom={scrollToBottom}
                hitBottom={hitBottom}
                uploading={uploading}
                showPromptHints={() => {
                  // Click again to close
                  if (promptHints.length > 0) {
                    setPromptHints([]);
                    return;
                  }

                  inputRef.current?.focus();
                  setUserInput("/");
                  onSearch("");
                }}
                setShowShortcutKeyModal={setShowShortcutKeyModal}
                setUserInput={setUserInput}
                setShowChatSidePanel={setShowChatSidePanel}
              />
              <label
                className={clsx(styles["chat-input-panel-inner"], {
                  [styles["chat-input-panel-inner-attach"]]:
                    attachImages.length !== 0,
                })}
                htmlFor="chat-input"
              >
                <textarea
                  id="chat-input"
                  ref={inputRef}
                  className={styles["chat-input"]}
                  placeholder={Locale.Chat.Input(submitKey)}
                  onInput={(e) => onInput(e.currentTarget.value)}
                  value={userInput}
                  onKeyDown={onInputKeyDown}
                  onFocus={scrollToBottom}
                  onClick={scrollToBottom}
                  onPaste={handlePaste}
                  rows={inputRows}
                  autoFocus={autoFocus}
                  style={{
                    fontSize: config.fontSize,
                    fontFamily: config.fontFamily,
                  }}
                />
                {attachImages.length != 0 && (
                  <div className={styles["attach-images"]}>
                    {attachImages.map((dataUrl, index) => {
                      const { isImage, name, isTextFile } =
                        getAttachmentInfo(dataUrl);
                      // console.log("原始 dataUrl:", dataUrl);
                      // console.log("getAttachmentInfo 返回的 isImage:", isImage);
                      return (
                        <div
                          key={index}
                          className={styles["attach-image"]}
                          title={
                            !isImage && isTextFile ? name : "Image attachment"
                          }
                          style={
                            isImage
                              ? { backgroundImage: `url("${dataUrl}")` }
                              : {}
                          }
                        >
                          {!isImage && isTextFile && (
                            <div className={styles["text-file-preview"]}>
                              {/* You should replace this with an actual SVG icon component */}
                              <FileTextIcon />
                              <span className={styles["text-file-name"]}>
                                {name}
                              </span>
                            </div>
                          )}
                          <div className={styles["attach-image-mask"]}>
                            <DeleteImageButton
                              deleteImage={() => {
                                setAttachImages(
                                  attachImages.filter((_, i) => i !== index),
                                );
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <IconButton
                  icon={<SendWhiteIcon />}
                  text={Locale.Chat.Send}
                  className={styles["chat-input-send"]}
                  type="primary"
                  onClick={() => doSubmit(userInput)}
                  disabled={isSubmitting || uploading}
                />
              </label>
            </div>
          </div>
          <div
            className={clsx(styles["chat-side-panel"], {
              [styles["mobile"]]: isMobileScreen,
              [styles["chat-side-panel-show"]]: showChatSidePanel,
            })}
          >
            {showChatSidePanel && (
              <RealtimeChat
                onClose={() => {
                  setShowChatSidePanel(false);
                }}
                onStartVoice={async () => {
                  console.log("start voice");
                }}
              />
            )}
          </div>
        </div>
      </div>
      {showExport && (
        <ExportMessageModal onClose={() => setShowExport(false)} />
      )}

      {isEditingMessage && (
        <EditMessageModal
          onClose={() => {
            setIsEditingMessage(false);
          }}
        />
      )}

      {showShortcutKeyModal && (
        <ShortcutKeyModal onClose={() => setShowShortcutKeyModal(false)} />
      )}
    </>
  );
}

export function Chat() {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  return <_Chat key={session.id}></_Chat>;
}
