import { Injectable } from "@angular/core";
import "rxjs/add/operator/map";
import { Observable } from "rxjs";
import * as moment from "moment";
import { AngularFirestore } from "angularfire2/firestore";
import { Disclosure } from "../../model/Disclosure";
import { AngularFireAuth } from "angularfire2/auth";
import { SettingsProvider } from "../settings/settings";
import { CustomTagsProvider } from "../custom-tags/custom-tags";

/*
  Generated class for the DisclosureProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class DisclosureProvider {
  private readonly COLLECTION_NAME = "disclosures";

  private lastVisible: any;

  constructor(
    private afAuth: AngularFireAuth,
    private afs: AngularFirestore,
    private ctp: CustomTagsProvider,
  ) {}

  public all(n: number = 20) {
    return this.afAuth.authState
      .filter(user => !!user)
      .mergeMap(() =>
        this.afs
          .collection(this.COLLECTION_NAME, ref =>
            ref.orderBy("time", "desc").limit(n)
          )
          .valueChanges()
      )
      .map(e => e.map(_e => new Disclosure(_e)));
  }

  public by_date(date: string): Observable<Disclosure[]> {
    const start = moment(date)
      .utcOffset(9)
      .valueOf();
    const end = moment(date)
      .utcOffset(9)
      .add(1, "days")
      .valueOf();
    return this.afAuth.authState
      .do(user => console.log(user))
      .filter(user => !!user)
      .mergeMap(() =>
        Observable.combineLatest(
          this.afs
            .collection<Disclosure>(this.COLLECTION_NAME, ref =>
              ref
                .orderBy("time", "desc")
                .where("time", ">=", start)
                .where("time", "<", end)
            )
            .valueChanges(),
          this.ctp.tag$
        )
      )
      .map(([e, tags]) =>
        e.map(d => {
          tags.forEach(tag => {
            d.tags[tag] = d.title.match(new RegExp(tag));
          });
          return d;
        })
      );
  }

  public get(code: string = "", n: number = 20, pointer: any = null) {
    // console.log("lv", this.lastVisible);
    console.log(pointer && pointer.data());
    let query = this.afs.firestore
      .collection(this.COLLECTION_NAME)
      .orderBy("time", "desc");

    if (code) {
      query = query.where("code", "==", code);
    }

    if (pointer) {
      query = query.startAfter(pointer);
    }

    query = query.limit(n);

    return query.get().then(docSnapshot => {
      this.lastVisible = docSnapshot.docs[docSnapshot.docs.length - 1];
      return docSnapshot;
    });
  }
}
