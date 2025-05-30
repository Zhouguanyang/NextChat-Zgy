import * as React from "react";

import styles from "./button.module.scss";
import { CSSProperties } from "react";
import clsx from "clsx";

export type ButtonType = "primary" | "danger" | null;

export function IconButton(props: {
  onClick?: () => void;
  icon?: JSX.Element;
  type?: ButtonType;
  text?: string;
  bordered?: boolean;
  shadow?: boolean;
  className?: string;
  title?: string;
  disabled?: boolean;
  tabIndex?: number;
  autoFocus?: boolean;
  style?: CSSProperties;
  aria?: string;
}) {
  return (
    <button
      className={clsx(
        "clickable",
        styles["icon-button"],
        {
          [styles.border]: props.bordered,
          [styles.shadow]: props.shadow,
          [styles.disabled]: props.disabled,
        },
        styles[props.type ?? ""],
        props.className,
      )}
      onClick={props.disabled ? undefined : props.onClick} // <--- 关键修改：disabled 时不执行 onClick
      title={props.title}
      disabled={props.disabled}
      role="button"
      tabIndex={props.disabled ? -1 : props.tabIndex} // <--- 可选：disabled 时设置 tabIndex 为 -1
      autoFocus={props.disabled ? false : props.autoFocus} // <--- 可选：disabled 时不自动聚焦
      style={props.style}
      aria-label={props.aria}
    >
      {props.icon && (
        <div
          aria-label={props.text || props.title}
          className={clsx(styles["icon-button-icon"], {
            "no-dark": props.type === "primary",
          })}
        >
          {props.icon}
        </div>
      )}

      {props.text && (
        <div
          aria-label={props.text || props.title}
          className={styles["icon-button-text"]}
        >
          {props.text}
        </div>
      )}
    </button>
  );
}
