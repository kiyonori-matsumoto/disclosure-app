import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { SavedDocumentPage } from './saved-document';
import { PipesModule } from '../../pipes/pipes.module';

@NgModule({
  declarations: [
    SavedDocumentPage,
  ],
  imports: [
    IonicPageModule.forChild(SavedDocumentPage),
    PipesModule,
  ],
})
export class SavedDocumentPageModule {}
