import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { DocumentListPage } from './document-list';
import { TwitterTimePipe } from "../../pipes/twitter-time/twitter-time";
import { TwitterTimeModule } from '../../pipes/twitter-time/twitter-time.module';
import { PipesModule } from '../../pipes/pipes.module';

@NgModule({
  declarations: [
    DocumentListPage,
    // TwitterTimePipe,
  ],
  imports: [
    IonicPageModule.forChild(DocumentListPage),
    TwitterTimeModule,
    PipesModule,
  ],
})
export class DocumentListPageModule {}
