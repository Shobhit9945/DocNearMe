@@ -139,51 +139,51 @@ export const StudentDashboard: React.FC = () => {
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                      <p className="text-foreground">{entry.content}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        );
      case 'profile':
        return (
          <Card variant="elevated">
            <CardHeader>
              <CardTitle>{t('profile')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-3xl">👤</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{user?.fullName}</h3>
                  <p className="text-muted-foreground">{user?.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      default:
        return (
          <div className="space-y-6">
            {/* Welcome Message */}
            <div className="text-center py-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {language === 'ja' 
                  ? `おかえり、${user?.fullName?.split(' ')[0] || ''}さん！` 
                  : `Welcome back, ${user?.fullName?.split(' ')[0] || ''}!`}
              </h2>
              <p className="text-muted-foreground">
                {language === 'ja' 
                  ? '今日も素敵な一日を過ごしましょう'
                  : "Let's make today a great day"}
              </p>
            </div>

            {/* Stats */}
            <StudentStats streak={5} totalEntries={journalEntries.length} />
