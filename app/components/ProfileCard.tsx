// ProfileCard.tsx
import React, { useEffect, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
import { useInView } from "react-intersection-observer";
import styles from "../styles/ProfileCard.module.css";

interface ProfileCardProps {
  avatarUrl: string;
  iconUrl?: string;
  grainUrl?: string;
  behindGradient?: string;
  innerGradient?: string;
  showBehindGradient?: boolean;
  className?: string;
  enableTilt?: boolean;
  enableMobileTilt?: boolean;
  mobileTiltSensitivity?: number;
  miniAvatarUrl?: string;
  name?: string;
  title?: string;
  handle?: string;
  status?: string;
  contactText?: string;
  showUserInfo?: boolean;
  onContactClick?: () => void;
  avatarWidth?: number;
  avatarHeight?: number;
  avatarPriority?: boolean;
}

const DEFAULT_PROPS = {
  iconUrl: "",
  grainUrl: "",
  showBehindGradient: true,
  className: "",
  enableTilt: true,
  enableMobileTilt: false,
  mobileTiltSensitivity: 5,
  name: "Javi A. Torres",
  title: "Software Engineer",
  handle: "javicodes",
  status: "Online",
  contactText: "Contact",
  showUserInfo: true,
  avatarWidth: 120,
  avatarHeight: 120,
  avatarPriority: true,
} as const;

const DEFAULT_BEHIND_GRADIENT =
  "radial-gradient(farthest-side circle at var(--pointer-x) var(--pointer-y),hsla(266,100%,90%,var(--card-opacity)) 4%,hsla(266,50%,80%,calc(var(--card-opacity)*0.75)) 10%,hsla(266,25%,70%,calc(var(--card-opacity)*0.5)) 50%,hsla(266,0%,60%,0) 100%),radial-gradient(35% 52% at 55% 20%,#00ffaac4 0%,#073aff00 100%),radial-gradient(100% 100% at 50% 50%,#00c1ffff 1%,#073aff00 76%),conic-gradient(from 124deg at 50% 50%,#c137ffff 0%,#07c6ffff 40%,#07c6ffff 60%,#c137ffff 100%)";

const DEFAULT_INNER_GRADIENT =
  "linear-gradient(145deg,#60496e8c 0%,#71C4FF44 100%)";

const ANIMATION_CONFIG = {
  SMOOTH_DURATION: 600,
  INITIAL_DURATION: 1500,
  INITIAL_X_OFFSET: 70,
  INITIAL_Y_OFFSET: 60,
  DEVICE_BETA_OFFSET: 20,
  THROTTLE_MS: 16,
} as const;

const clamp = (value: number, min = 0, max = 100): number =>
  Math.min(Math.max(value, min), max);

const round = (value: number, precision = 3): number =>
  parseFloat(value.toFixed(precision));

const adjust = (
  value: number,
  fromMin: number,
  fromMax: number,
  toMin: number,
  toMax: number
): number =>
  round(toMin + ((toMax - toMin) * (value - fromMin)) / (fromMax - fromMin));

const easeInOutCubic = (x: number): number =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

const useThrottledCallback = <Args extends unknown[], R>(
  callback: (...args: Args) => R,
  delay: number
): ((...args: Args) => R | undefined) => {
  const lastCall = useRef(0);
  return useCallback(
    (...args: Args): R | undefined => {
      const now = performance.now();
      if (now - lastCall.current >= delay) {
        lastCall.current = now;
        return callback(...args);
      }
      return undefined;
    },
    [callback, delay]
  );
};

const useAnimationFrame = () => {
  const rafRef = useRef<number | null>(null);

  const start = useCallback((callback: FrameRequestCallback) => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(callback);
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => stop, [stop]);

  return { start, stop };
};

const ProfileCardComponent: React.FC<ProfileCardProps> = (props) => {
  const finalProps = { ...DEFAULT_PROPS, ...props };
  const {
    avatarUrl,
    iconUrl,
    grainUrl,
    behindGradient,
    innerGradient,
    showBehindGradient,
    className,
    enableTilt,
    enableMobileTilt,
    mobileTiltSensitivity,
    miniAvatarUrl,
    name,
    title,
    handle,
    status,
    contactText,
    showUserInfo,
    onContactClick,
    avatarWidth,
    avatarHeight,
    avatarPriority,
  } = finalProps;

  const wrapRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const { start: startAnimation, stop: stopAnimation } = useAnimationFrame();

  const { ref: observerRef, inView } = useInView({
    threshold: 0.1,
    triggerOnce: false,
  });

  const shouldEnableTilt = enableTilt && inView;

  const animationHandlers = useMemo(() => {
    if (!shouldEnableTilt) return null;
    const updateCardTransform = (
      offsetX: number,
      offsetY: number,
      card: HTMLElement,
      wrap: HTMLElement
    ) => {
      const width = card.clientWidth;
      const height = card.clientHeight;
      const percentX = clamp((100 / width) * offsetX);
      const percentY = clamp((100 / height) * offsetY);
      const centerX = percentX - 50;
      const centerY = percentY - 50;
      const cssText = `
        --pointer-x: ${percentX}%;
        --pointer-y: ${percentY}%;
        --background-x: ${adjust(percentX, 0, 100, 35, 65)}%;
        --background-y: ${adjust(percentY, 0, 100, 35, 65)}%;
        --pointer-from-center: ${clamp(
          Math.hypot(percentY - 50, percentX - 50) / 50,
          0,
          1
        )};
        --pointer-from-top: ${percentY / 100};
        --pointer-from-left: ${percentX / 100};
        --rotate-x: ${round(-(centerX / 5))}deg;
        --rotate-y: ${round(centerY / 4)}deg;
      `
        .replace(/\s+/g, " ")
        .trim();
      wrap.style.cssText += cssText;
    };
    const createSmoothAnimation = (
      duration: number,
      startX: number,
      startY: number,
      card: HTMLElement,
      wrap: HTMLElement
    ) => {
      const startTime = performance.now();
      const targetX = wrap.clientWidth / 2;
      const targetY = wrap.clientHeight / 2;
      const animationLoop = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = clamp(elapsed / duration);
        const easedProgress = easeInOutCubic(progress);
        const currentX = adjust(easedProgress, 0, 1, startX, targetX);
        const currentY = adjust(easedProgress, 0, 1, startY, targetY);
        updateCardTransform(currentX, currentY, card, wrap);
        if (progress < 1) {
          startAnimation(animationLoop);
        }
      };
      startAnimation(animationLoop);
    };
    return {
      updateCardTransform,
      createSmoothAnimation,
    };
  }, [shouldEnableTilt, startAnimation]);

  const handlePointerMove = useThrottledCallback((event: PointerEvent) => {
    const card = cardRef.current;
    const wrap = wrapRef.current;
    if (!card || !wrap || !animationHandlers) return;
    const rect = card.getBoundingClientRect();
    animationHandlers.updateCardTransform(
      event.clientX - rect.left,
      event.clientY - rect.top,
      card,
      wrap
    );
  }, ANIMATION_CONFIG.THROTTLE_MS);

  const handlePointerEnter = useCallback(() => {
    const card = cardRef.current;
    const wrap = wrapRef.current;
    if (!card || !wrap) return;
    stopAnimation();
    wrap.classList.add(styles.active);
    card.classList.add(styles.active);
  }, [stopAnimation]);

  const handlePointerLeave = useCallback(
    (event: PointerEvent) => {
      const card = cardRef.current;
      const wrap = wrapRef.current;
      if (!card || !wrap || !animationHandlers) return;
      animationHandlers.createSmoothAnimation(
        ANIMATION_CONFIG.SMOOTH_DURATION,
        event.offsetX,
        event.offsetY,
        card,
        wrap
      );
      wrap.classList.remove(styles.active);
      card.classList.remove(styles.active);
    },
    [animationHandlers]
  );

  const handleDeviceOrientation = useThrottledCallback(
    (event: DeviceOrientationEvent) => {
      const card = cardRef.current;
      const wrap = wrapRef.current;
      if (!card || !wrap || !animationHandlers) return;
      const { beta, gamma } = event;
      if (beta === null || gamma === null) return;
      animationHandlers.updateCardTransform(
        card.clientHeight / 2 + gamma * mobileTiltSensitivity,
        card.clientWidth / 2 +
          (beta - ANIMATION_CONFIG.DEVICE_BETA_OFFSET) * mobileTiltSensitivity,
        card,
        wrap
      );
    },
    ANIMATION_CONFIG.THROTTLE_MS
  );

  useEffect(() => {
    if (!shouldEnableTilt || !animationHandlers) return;
    const card = cardRef.current;
    const wrap = wrapRef.current;
    if (!card || !wrap) return;

    const handleClick = () => {
      if (!enableMobileTilt || location.protocol !== "https:") return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (
        typeof (window.DeviceMotionEvent as any)?.requestPermission ===
        "function"
      ) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window.DeviceMotionEvent as any)
          .requestPermission()
          .then((state: PermissionState) => {
            if (state === "granted") {
              window.addEventListener(
                "deviceorientation",
                handleDeviceOrientation,
                { passive: true }
              );
            }
          })
          .catch((err: unknown) => {
            console.error(err);
          });
      } else {
        window.addEventListener("deviceorientation", handleDeviceOrientation, {
          passive: true,
        });
      }
    };

    const options = { passive: true };
    card.addEventListener("pointerenter", handlePointerEnter, options);
    card.addEventListener("pointermove", handlePointerMove, options);
    card.addEventListener("pointerleave", handlePointerLeave, options);
    card.addEventListener("click", handleClick, options);
    const initialX = wrap.clientWidth - ANIMATION_CONFIG.INITIAL_X_OFFSET;
    const initialY = ANIMATION_CONFIG.INITIAL_Y_OFFSET;
    animationHandlers.updateCardTransform(initialX, initialY, card, wrap);
    animationHandlers.createSmoothAnimation(
      ANIMATION_CONFIG.INITIAL_DURATION,
      initialX,
      initialY,
      card,
      wrap
    );
    return () => {
      card.removeEventListener("pointerenter", handlePointerEnter);
      card.removeEventListener("pointermove", handlePointerMove);
      card.removeEventListener("pointerleave", handlePointerLeave);
      card.removeEventListener("click", handleClick);
      window.removeEventListener("deviceorientation", handleDeviceOrientation);
      stopAnimation();
    };
  }, [
    shouldEnableTilt,
    enableMobileTilt,
    animationHandlers,
    handlePointerMove,
    handlePointerEnter,
    handlePointerLeave,
    handleDeviceOrientation,
    stopAnimation,
  ]);
  const cardStyle = useMemo(
    () =>
      ({
        "--icon": iconUrl ? `url(${iconUrl})` : "none",
        "--grain": grainUrl ? `url(${grainUrl})` : "none",
        "--behind-gradient": showBehindGradient
          ? behindGradient ?? DEFAULT_BEHIND_GRADIENT
          : "none",
        "--inner-gradient": innerGradient ?? DEFAULT_INNER_GRADIENT,
      } as React.CSSProperties),
    [iconUrl, grainUrl, showBehindGradient, behindGradient, innerGradient]
  );
  const handleContactClick = useCallback(() => {
    onContactClick?.();
  }, [onContactClick]);
  const handleImageError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const target = e.currentTarget;
      target.style.visibility = "hidden";
      target.setAttribute("aria-hidden", "true");
    },
    []
  );
  const blurDataURL =
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q==";
  return (
    <div
      ref={(el) => {
        wrapRef.current = el;
        observerRef(el);
      }}
      className={`${styles["pc-card-wrapper"]} ${className}`.trim()}
      style={cardStyle}
    >
      <section ref={cardRef} className={styles["pc-card"]}>
        <div className={styles["pc-inside"]}>
          <div className={styles["pc-shine"]} />
          <div className={styles["pc-glare"]} />
          <div
            className={`${styles["pc-content"]} ${styles["pc-avatar-content"]}`}
          >
            {avatarUrl && avatarUrl !== "<Placeholder for avatar URL>" ? (
              <Image
                className={styles.avatar}
                src={avatarUrl}
                alt={`${name || "User"} avatar`}
                width={avatarWidth}
                height={avatarHeight}
                priority={avatarPriority}
                placeholder="blur"
                blurDataURL={blurDataURL}
                onError={handleImageError}
              />
            ) : (
              <div
                className={`${styles.avatar} ${styles.placeholder}`}
                style={{
                  width: avatarWidth,
                  height: avatarHeight,
                  backgroundColor: "#374151",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#9CA3AF",
                  fontSize: "14px",
                }}
              >
                {name?.charAt(0)?.toUpperCase() || "?"}
              </div>
            )}
            {showUserInfo && (
              <div className={styles["pc-user-info"]}>
                <div className={styles["pc-user-details"]}>
                  <div className={styles["pc-mini-avatar"]}>
                    {(miniAvatarUrl || avatarUrl) &&
                    (miniAvatarUrl || avatarUrl) !==
                      "<Placeholder for avatar URL>" ? (
                      <Image
                        src={miniAvatarUrl || avatarUrl}
                        alt={`${name || "User"} mini avatar`}
                        width={24}
                        height={24}
                        loading="lazy"
                        blurDataURL={blurDataURL}
                        onError={handleImageError}
                      />
                    ) : (
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          backgroundColor: "#374151",
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#9CA3AF",
                          fontSize: "10px",
                        }}
                      >
                        {name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                    )}
                  </div>
                  <div className={styles["pc-user-text"]}>
                    <div className={styles["pc-handle"]}>@{handle}</div>
                    <div className={styles["pc-status"]}>{status}</div>
                  </div>
                </div>
                <button
                  className={styles["pc-contact-btn"]}
                  onClick={handleContactClick}
                  style={{ pointerEvents: "auto" }}
                  type="button"
                  aria-label={`Contact ${name || "user"}`}
                >
                  {contactText}
                </button>
              </div>
            )}
          </div>
          <div className={styles["pc-content"]}>
            <div className={styles["pc-details"]}>
              <h3>{name}</h3>
              <p>{title}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

const ProfileCard = React.memo(ProfileCardComponent);

export default ProfileCard;
