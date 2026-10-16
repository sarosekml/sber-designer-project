import { FC, ReactElement, ReactNode } from 'react';

/** @todo There are utility types and there are duplicates from core library -
 * should be remove from here and use from core after dependency inversion will be completed  */
type KeysOfType<T, U> = { [K in keyof T]: T[K] extends U ? K : never }[keyof T];
/** @todo There are utility types and there are duplicates from core library -
 * should be remove from here and use from core after dependency inversion will be completed  */
type RequiredKeys<T> = Exclude<KeysOfType<T, Exclude<T[keyof T], undefined>>, undefined>;
/** @todo There are utility types and there are duplicates from core library -
 * should be remove from here and use from core after dependency inversion will be completed  */
type ExcludeOptionalProps<T> = Pick<T, RequiredKeys<T>>;

export interface ModalControls<Data = void> {
  closeModal: () => void;
  /**
   * Here we exclude optional props then check if there are other props,
   * If there are others then you can't use openModal - it's void,
   * otherwise it's usable () => void function
   */
  openModal: keyof ExcludeOptionalProps<Data> extends never ? () => void : void;
  openModalWith: (data: Data) => void;
}

export interface ModalRootProps {
  listeningKey: string;
}

// ==================================================================
// ========================= Deprecated =============================
// ==================================================================

/**
 * @deprecated Use ModalFsdProps
 */
interface ModalProps<Data = void> extends Omit<ModalControls<Data>, 'openModal'> {
  data: Data;
  /** Reopens modal with currently provided props */
  reopenModal: () => void;
}

/**
 * @deprecated Use ModalFsdComponent
 */
export type ModalComponent<Data = void> = FC<ModalProps<Data>>;

/**
 * @deprecated Use ModalFsdComponentDefinition
 */
export interface ModalComponentDefinition<Data> {
  Component: ModalComponent<Data>;
  data: Data;
}

/**
 * @deprecated Use ModalFsdRootEvents
 */
export interface ModalRootEvents<Data> {
  closeModal: ModalComponent<Data>;
  openModal: ModalComponentDefinition<Data>;
}

// ==================================================================
// ========================== Relevant ==============================
// ==================================================================

export interface ModalFsdProps<Data = void> {
  data: Data;
  closeModal: () => void;
}

export type ModalFsdComponent<Data = void> = FC<ModalFsdProps<Data>>;

export interface ModalFsdComponentDefinition<Data> {
  Component: ModalFsdComponent<Data>;
  data: Data;
}

export interface ModalFsdRootEvents<Data> {
  closeModal: ModalFsdComponent<Data>;
  openModal: ModalFsdComponentDefinition<Data>;
}
