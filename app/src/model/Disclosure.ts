export class Disclosure {
  public code: string;
  public company: string;
  public title: string;
  public document: string;
  public exchanges: string;
  public time: number;
  public tags: any;
  public select: boolean;

  constructor(obj: any = {}) {
    Object.assign(this, obj);
  }

}
