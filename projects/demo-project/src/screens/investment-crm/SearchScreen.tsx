import { SearchHero, SearchResultsCard } from "../../components/business-cards";
import { AppShell, PageHeader } from "../../components/layout";
import { Button } from "../../components/primitives";
import { searchResults } from "../../data/demo";

export function SearchScreen() {
  return (
    <AppShell screenId="screen-search" section="Search">
      <PageHeader
        title="Global search"
        subtitle="Command-palette style search across funds, assets, ideas, communications, and actions."
        actions={<Button variant="secondary">Open shortcuts</Button>}
      />

      <SearchHero
        active="All"
        filters={["All", "Funds", "Assets", "Ideas"]}
        query="murmansk"
        resultCount="4 best matches across 148 indexed objects"
      />

      <SearchResultsCard items={searchResults} />
    </AppShell>
  );
}
