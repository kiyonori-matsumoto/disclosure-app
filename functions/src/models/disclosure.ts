export interface Disclosure {
  code: string;
  company: string;
  title: string;
  tags?: { [key: string]: boolean };
  document: string;
  exchanges: string;
  time: number;
  noSend?: boolean;
}
