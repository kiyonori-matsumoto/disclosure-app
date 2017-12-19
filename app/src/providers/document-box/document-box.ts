import { Injectable } from '@angular/core';
import 'rxjs/add/operator/map';
import { AngularFirestore } from 'angularfire2/firestore';
import { AngularFireAuth } from 'angularfire2/auth';
import { Observable, Subject, ReplaySubject } from 'rxjs';


/*
  Generated class for the DocumentBoxProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class DocumentBoxProvider {
  
  private readonly documentBoxSubject = new ReplaySubject<any>(1);
  public readonly documentBox$: Observable<any> = this.documentBoxSubject
  .publishReplay(1).refCount();

  private uid$: Observable<string>;

  constructor(private afs: AngularFirestore, private afAuth: AngularFireAuth) {
    console.log('Hello DocumentBoxProvider Provider');

    this.uid$ = this.afAuth.authState
    .filter(user => !!user)
    .map(user => user.uid)

    this.uid$
    .mergeMap(uid => this.collection(uid).valueChanges())
    .subscribe(this.documentBoxSubject);
  }
  
  private collection(uid) {
    return this.afs.collection('users').doc(uid).collection('disclosures')
  }

  private doc(uid, doc_id) {
    return this.collection(uid).doc(doc_id);
  }

  private ref(uid) {
    return this.collection(uid).ref;
  }

  public get() {
    return this.documentBox$;
  }

  public add(doc_id: string, doc_data) {
    return this.uid$.take(1)
    .mergeMap(uid => this.collection(uid).doc(doc_id).set(doc_data));
  }

  public delete(doc_id: string) {
    return this.uid$.take(1)
    .mergeMap(uid => this.collection(uid).doc(doc_id).delete());
  }
}
