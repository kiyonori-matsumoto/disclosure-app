import { Injectable } from '@angular/core';
import 'rxjs/add/operator/map';
import { Observable } from "rxjs";
import * as moment from 'moment';
import { AngularFirestore } from 'angularfire2/firestore';
import { Disclosure } from '../../model/Disclosure';

/*
  Generated class for the DisclosureProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class DisclosureProvider {

  private lastVisible: any;

  constructor(private afs: AngularFirestore) {}

  public all(n: number = 20) {
    return this.afs.collection('disclosures', ref => ref.orderBy('time', 'desc').limit(n)).valueChanges()
    .map(e => e.map(_e => new Disclosure(_e)));
  }

  public by_date(date: string): Observable<Disclosure[]> {
    const start = moment(date).utcOffset(9).valueOf();
    const end =   moment(date).utcOffset(9).add(1, 'days').valueOf()
    return this.afs.collection('disclosures', ref => ref.orderBy('time', 'desc').where('time', '>=', start).where('time', '<', end)).valueChanges().map(e => e.map(_e => new Disclosure(_e)));
  }

  public get(code: string = '', n: number = 20, pointer: any = null) {
    // console.log("lv", this.lastVisible);
    console.log(pointer && pointer.data())
    let query = this.afs.firestore.collection('disclosures').orderBy('time', 'desc')
    
    if(code) { query = query.where('code', '==', code); }

    if (pointer) { query = query.startAfter(pointer); }

    query = query.limit(n);

    return query.get().then((docSnapshot) => {
      this.lastVisible = docSnapshot.docs[docSnapshot.docs.length-1];
      return docSnapshot;
    })
  }
}
