import { Injectable } from '@angular/core';
import 'rxjs/add/operator/map';
import { AngularFireDatabase, FirebaseListObservable } from "angularfire2/database";
import { Observable } from "rxjs";

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
    return this.afDB.list('/disclosures', {query: {orderByChild: 'time', limitToLast: n}}) as Observable<any>;
  }

  public next(pointer, n: number = 20) {
    return this.afDB.list('/disclosure', {query: { limitToLast: 20, orderByChild: 'time', endAt: pointer }}) as Observable<any>;
  }

}
