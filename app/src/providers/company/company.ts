import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import 'rxjs/add/operator/map';
import { AngularFirestore } from 'angularfire2/firestore';
import { ReplaySubject, Observable, ConnectableObservable } from 'rxjs';
import * as firebase from 'firebase';

/*
  Generated class for the CompanyProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class CompanyProvider {

  private readonly obs: Observable<firebase.firestore.QuerySnapshot>;

  constructor(private afs: AngularFirestore) {
    console.log('Hello CompanyProvider Provider');
    this.obs = Observable.fromPromise(this.afs.collection('companies').ref.get()).publishReplay(1).refCount();
  }

  public all() {
    return this.obs.map(e => e.docs);
  }

  public byCode(code: string) {
    return this.all()
    .map(e => e.find(_e => _e.id === code))
    .map(e => e ? e.data(): {})
    .do(e=>console.log(e))
  }

}
