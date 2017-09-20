import { Injectable } from '@angular/core';
import 'rxjs/add/operator/map';
import { AngularFireDatabase, FirebaseListObservable } from "angularfire2/database";
import { Observable } from "rxjs";
import * as moment from 'moment';

/*
  Generated class for the DisclosureProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class DisclosureProvider {

  constructor(private afDB: AngularFireDatabase) {
  }

  public all(n: number = 20) {
    return this.afDB.list('/disclosures', {query: {orderByChild: 'time', limitToLast: n}});
  }

  public by_date(date: string) {
    return this.afDB.list('/disclosures', {query: {orderByChild: 'time', startAt: moment(date).utcOffset(9).valueOf(), endAt: moment(date).utcOffset(9).add(1, 'days').valueOf() } })
    .map(e => e.sort((a, b) => a.time - b.time));
  }

  public next(pointer, n: number = 20) {
    return this.afDB.list('/disclosure', {query: { limitToLast: 20, orderByChild: 'time', endAt: pointer }, })
  }

}
